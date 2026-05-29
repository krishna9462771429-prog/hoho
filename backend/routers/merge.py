import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from middleware.auth import get_current_user
from supabase_client import get_supabase
from merge_engine import (
    execute_merge,
    MergeExecutionRequest,
    MergeExecutionResult,
    MergeStrategy,
    ConflictResolution,
    TimeoutConfig,
    RetryConfig,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ──────────────────────────────────────────────
# Request models (thin wrappers over engine models)
# ──────────────────────────────────────────────

class ExecuteMergeRequest(BaseModel):
    api_ids: List[str] = Field(min_length=2, max_length=20)
    strategy: MergeStrategy = MergeStrategy.MERGE
    user_id: Optional[str] = None
    workflow_id: Optional[str] = None
    conflict_resolution: ConflictResolution = ConflictResolution.AVERAGE
    normalize: bool = True
    timeout: Optional[TimeoutConfig] = None
    retry: Optional[RetryConfig] = None


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _build_metadata(result: MergeExecutionResult) -> Dict[str, Any]:
    return {
        "latencies": result.metadata.get("latencies", {}),
        "status_codes": result.metadata.get("status_codes", {}),
        "response_sizes": result.metadata.get("response_sizes", {}),
        "retry_counts": result.metadata.get("retry_counts", {}),
    }


async def _persist_execution(
    user_id: Optional[str],
    workflow_id: Optional[str],
    result: MergeExecutionResult,
    api_ids: List[str],
) -> None:
    """Fire-and-forget DB writes; errors are logged, never raised."""
    try:
        sb = get_supabase()
        now = datetime.now(timezone.utc).isoformat()

        # Store one api_log per API call
        log_rows = []
        latencies = result.metadata.get("latencies", {})
        status_codes = result.metadata.get("status_codes", {})

        for err in result.errors:
            if user_id and err.get("api_id"):
                log_rows.append({
                    "api_id": err["api_id"],
                    "user_id": user_id,
                    "status": "error",
                    "status_code": err.get("status_code"),
                    "latency_ms": err.get("latency_ms", 0),
                    "error_message": err.get("error", ""),
                    "checked_at": now,
                })

        for api_name, latency in latencies.items():
            sc = status_codes.get(api_name)
            if sc and sc < 400 and user_id:
                # We don't have api_id by name here — skip per-API success logs
                # to avoid an extra name→id lookup on hot path
                pass

        if log_rows:
            sb.table("api_logs").insert(log_rows).execute()

        # Update workflow call counter
        if workflow_id:
            wf = sb.table("workflows").select("total_calls").eq("id", workflow_id).maybeSingle().execute()
            if wf.data:
                sb.table("workflows").update({
                    "total_calls": (wf.data.get("total_calls") or 0) + 1,
                    "updated_at": now,
                }).eq("id", workflow_id).execute()

        # Store summary in monitoring_logs
        if user_id:
            sb.table("monitoring_logs").insert({
                "user_id": user_id,
                "service_type": "merge_execution",
                "service_id": workflow_id or api_ids[0],
                "status": "success" if result.success else "error",
                "message": (
                    f"strategy={result.strategy} "
                    f"ok={result.successful_apis}/{result.total_apis} "
                    f"time={result.execution_time_ms}ms"
                ),
                "metadata": {
                    "strategy": result.strategy,
                    "execution_time_ms": result.execution_time_ms,
                    "successful_apis": result.successful_apis,
                    "failed_apis": result.failed_apis,
                    "workflow_id": workflow_id,
                },
                "logged_at": now,
            }).execute()

    except Exception as exc:
        logger.error("Failed to persist merge execution metrics: %s", exc)


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.post("/execute")
async def execute_merge_endpoint(req: ExecuteMergeRequest):
    try:
        sb = get_supabase()
        apis_res = sb.table("apis").select("*").in_("id", req.api_ids).execute()
        if not apis_res.data:
            raise HTTPException(status_code=404, detail="No APIs found for the provided IDs")

        apis = apis_res.data
        if len(apis) < 2:
            raise HTTPException(status_code=422, detail="At least 2 valid APIs are required")

        engine_req = MergeExecutionRequest(
            api_ids=req.api_ids,
            strategy=req.strategy,
            user_id=req.user_id,
            workflow_id=req.workflow_id,
            conflict_resolution=req.conflict_resolution,
            normalize=req.normalize,
            timeout=req.timeout,
            retry=req.retry,
        )

        result = await execute_merge(engine_req, apis)

        # Persist metrics without blocking the response
        asyncio.create_task(
            _persist_execution(req.user_id, req.workflow_id, result, req.api_ids)
        )

        return {
            "success": result.success,
            "strategy": result.strategy,
            "execution_time_ms": result.execution_time_ms,
            "successful_apis": result.successful_apis,
            "failed_apis": result.failed_apis,
            "total_apis": result.total_apis,
            "data": result.data,
            "errors": result.errors,
            "metadata": _build_metadata(result),
        }
    except Exception as e:
        logger.exception("Merge execution failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute/authenticated")
async def execute_merge_authenticated(
    req: ExecuteMergeRequest,
    user=Depends(get_current_user),
):
    """Authenticated variant — user_id is injected from JWT."""
    req.user_id = user["id"]
    return await execute_merge_endpoint(req)


@router.get("/{slug}")
async def execute_by_slug(slug: str):
    sb = get_supabase()
    wf_res = (
        sb.table("workflows")
        .select("*")
        .eq("endpoint_slug", slug)
        .eq("is_active", True)
        .maybeSingle()
        .execute()
    )
    if not wf_res.data:
        raise HTTPException(status_code=404, detail="Workflow not found")

    wf = wf_res.data
    api_ids: List[str] = wf.get("api_ids") or []
    if len(api_ids) < 2:
        raise HTTPException(status_code=422, detail="Workflow has fewer than 2 APIs")

    apis_res = sb.table("apis").select("*").in_("id", api_ids).execute()
    if not apis_res.data:
        raise HTTPException(status_code=404, detail="No APIs configured for this workflow")

    strategy_raw = wf.get("merge_strategy", "merge")
    try:
        strategy = MergeStrategy(strategy_raw)
    except ValueError:
        strategy = MergeStrategy.MERGE

    engine_req = MergeExecutionRequest(
        api_ids=api_ids,
        strategy=strategy,
        workflow_id=wf["id"],
        normalize=True,
    )

    result = await execute_merge(engine_req, apis_res.data)

    asyncio.create_task(
        _persist_execution(wf.get("user_id"), wf["id"], result, api_ids)
    )

    return {
        "workflow": wf["name"],
        "slug": slug,
        "success": result.success,
        "strategy": result.strategy,
        "execution_time_ms": result.execution_time_ms,
        "successful_apis": result.successful_apis,
        "failed_apis": result.failed_apis,
        "data": result.data,
        "errors": result.errors,
        "metadata": _build_metadata(result),
    }
