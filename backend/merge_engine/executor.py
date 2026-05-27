"""
MergeExecutor — production-grade parallel API orchestrator.

Key design decisions:
- Single shared httpx.AsyncClient per execution (connection pooling).
- asyncio.gather(return_exceptions=True) for safe concurrent execution.
- Per-API timeout + retry configs with exponential backoff + jitter.
- fallback_chain runs sequentially; all other strategies run in parallel.
- Cancellation-safe: tasks for first_success are cancelled after winner found.
- DB writes are fire-and-forget (EdgeRuntime.waitUntil equivalent via asyncio.create_task).
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from .models import (
    ApiCallResult,
    ConflictResolution,
    MergeExecutionRequest,
    MergeExecutionResult,
    MergeStrategy,
    RetryConfig,
    TimeoutConfig,
)
from .retry import DEFAULT_RETRY, DEFAULT_TIMEOUT, build_httpx_timeout, execute_with_retry
from .strategies import apply_strategy
from .utils import classify_timeout, is_retryable_error, response_size_bytes, safe_json_parse, utc_now_ms

logger = logging.getLogger(__name__)

# Shared limits for the httpx connection pool per executor instance
_POOL_LIMITS = httpx.Limits(max_connections=40, max_keepalive_connections=20)


async def _call_single_api(
    client: httpx.AsyncClient,
    api: Dict[str, Any],
    timeout_cfg: TimeoutConfig,
    retry_cfg: RetryConfig,
) -> ApiCallResult:
    api_id: str = api["id"]
    api_name: str = api["name"]

    httpx_timeout = build_httpx_timeout(timeout_cfg)
    start_ms = utc_now_ms()

    async def _do_request() -> httpx.Response:
        return await client.request(
            method=api.get("method", "GET"),
            url=api["url"],
            headers=api.get("headers") or {},
            timeout=httpx_timeout,
        )

    try:
        response, retry_count = await execute_with_retry(_do_request, retry_cfg)
        latency_ms = utc_now_ms() - start_ms

        body: Any = None
        try:
            body = response.json()
        except Exception:
            text = response.text
            body = safe_json_parse(text) or text

        expected_status = api.get("expected_status", 200)
        success = response.status_code == expected_status

        return ApiCallResult(
            api_id=api_id,
            api_name=api_name,
            success=success,
            status_code=response.status_code,
            latency_ms=latency_ms,
            response_size_bytes=response_size_bytes(body),
            retry_count=retry_count,
            data=body if success else None,
            error=None if success else f"Expected {expected_status}, got {response.status_code}",
        )

    except httpx.TimeoutException as exc:
        latency_ms = utc_now_ms() - start_ms
        return ApiCallResult(
            api_id=api_id,
            api_name=api_name,
            success=False,
            latency_ms=latency_ms,
            error=str(exc),
            timeout_type=classify_timeout(exc),
            retry_count=retry_cfg.max_retries,
        )
    except Exception as exc:
        latency_ms = utc_now_ms() - start_ms
        return ApiCallResult(
            api_id=api_id,
            api_name=api_name,
            success=False,
            latency_ms=latency_ms,
            error=str(exc),
        )


async def _parallel_execute(
    client: httpx.AsyncClient,
    apis: List[Dict[str, Any]],
    timeout_cfg: TimeoutConfig,
    retry_cfg: RetryConfig,
    per_api_config: Optional[Dict[str, Any]],
) -> List[ApiCallResult]:
    """Run all API calls concurrently; return_exceptions=True ensures no task crashes others."""

    async def _call(api: Dict[str, Any]) -> ApiCallResult:
        api_cfg = (per_api_config or {}).get(api["id"])
        t_cfg = (api_cfg.timeout if api_cfg and api_cfg.timeout else None) or timeout_cfg
        r_cfg = (api_cfg.retry if api_cfg and api_cfg.retry else None) or retry_cfg
        return await _call_single_api(client, api, t_cfg, r_cfg)

    raw_results = await asyncio.gather(*[_call(api) for api in apis], return_exceptions=True)

    results: List[ApiCallResult] = []
    for i, r in enumerate(raw_results):
        if isinstance(r, BaseException):
            results.append(ApiCallResult(
                api_id=apis[i]["id"],
                api_name=apis[i]["name"],
                success=False,
                latency_ms=0,
                error=str(r),
            ))
        else:
            results.append(r)  # type: ignore[arg-type]
    return results


async def _first_success_execute(
    client: httpx.AsyncClient,
    apis: List[Dict[str, Any]],
    timeout_cfg: TimeoutConfig,
    retry_cfg: RetryConfig,
    per_api_config: Optional[Dict[str, Any]],
) -> List[ApiCallResult]:
    """
    Launch all tasks concurrently; as soon as one succeeds, cancel the rest
    and return all completed results so far (including the winner).
    """
    loop = asyncio.get_event_loop()
    tasks: List[asyncio.Task] = []

    async def _call(api: Dict[str, Any]) -> ApiCallResult:
        api_cfg = (per_api_config or {}).get(api["id"])
        t_cfg = (api_cfg.timeout if api_cfg and api_cfg.timeout else None) or timeout_cfg
        r_cfg = (api_cfg.retry if api_cfg and api_cfg.retry else None) or retry_cfg
        return await _call_single_api(client, api, t_cfg, r_cfg)

    for api in apis:
        tasks.append(asyncio.create_task(_call(api)))

    winner: Optional[ApiCallResult] = None
    results: List[ApiCallResult] = []

    # Wait for tasks one-by-one in completion order
    pending = set(tasks)
    api_map = {task: apis[i] for i, task in enumerate(tasks)}

    while pending and winner is None:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            try:
                result = task.result()
                results.append(result)
                if result.success and winner is None:
                    winner = result
                    # Cancel remaining
                    for t in pending:
                        t.cancel()
            except (asyncio.CancelledError, Exception) as exc:
                api = api_map.get(task, {})
                results.append(ApiCallResult(
                    api_id=api.get("id", "unknown"),
                    api_name=api.get("name", "unknown"),
                    success=False,
                    latency_ms=0,
                    error=str(exc),
                ))

    return results


async def _fallback_chain_execute(
    client: httpx.AsyncClient,
    apis: List[Dict[str, Any]],
    timeout_cfg: TimeoutConfig,
    retry_cfg: RetryConfig,
    per_api_config: Optional[Dict[str, Any]],
) -> List[ApiCallResult]:
    """Execute APIs sequentially; stop at first success."""
    results: List[ApiCallResult] = []
    for api in apis:
        api_cfg = (per_api_config or {}).get(api["id"])
        t_cfg = (api_cfg.timeout if api_cfg and api_cfg.timeout else None) or timeout_cfg
        r_cfg = (api_cfg.retry if api_cfg and api_cfg.retry else None) or retry_cfg
        result = await _call_single_api(client, api, t_cfg, r_cfg)
        results.append(result)
        if result.success:
            break
    return results


async def execute_merge(
    req: MergeExecutionRequest,
    apis: List[Dict[str, Any]],
) -> MergeExecutionResult:
    """
    Main entry point.  Accepts validated API records from DB and executes
    the merge according to the requested strategy.
    """
    start_ms = utc_now_ms()
    timeout_cfg = req.timeout or DEFAULT_TIMEOUT
    retry_cfg = req.retry or DEFAULT_RETRY

    async with httpx.AsyncClient(
        limits=_POOL_LIMITS,
        follow_redirects=True,
    ) as client:
        if req.strategy == MergeStrategy.FIRST_SUCCESS:
            results = await _first_success_execute(client, apis, timeout_cfg, retry_cfg, req.per_api_config)
        elif req.strategy == MergeStrategy.FALLBACK_CHAIN:
            results = await _fallback_chain_execute(client, apis, timeout_cfg, retry_cfg, req.per_api_config)
        else:
            results = await _parallel_execute(client, apis, timeout_cfg, retry_cfg, req.per_api_config)

    execution_time_ms = utc_now_ms() - start_ms

    merged_data, overall_success, errors = apply_strategy(
        results, req.strategy, req.conflict_resolution, req.normalize
    )

    successful = [r for r in results if r.success]
    failed = [r for r in results if not r.success]

    metadata: Dict[str, Any] = {
        "latencies": {r.api_name: r.latency_ms for r in results},
        "status_codes": {r.api_name: r.status_code for r in results},
        "response_sizes": {r.api_name: r.response_size_bytes for r in results},
        "retry_counts": {r.api_name: r.retry_count for r in results},
        "timeout_types": {r.api_name: r.timeout_type for r in results if r.timeout_type},
    }

    return MergeExecutionResult(
        success=overall_success,
        strategy=req.strategy,
        execution_time_ms=execution_time_ms,
        successful_apis=len(successful),
        failed_apis=len(failed),
        total_apis=len(results),
        data=merged_data,
        errors=errors,
        metadata=metadata,
        workflow_id=req.workflow_id,
    )
