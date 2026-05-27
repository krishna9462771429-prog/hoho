import asyncio
import random
import logging
from typing import Any, Callable, Coroutine

import httpx

from .models import RetryConfig, TimeoutConfig
from .utils import is_retryable_error, classify_timeout

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = TimeoutConfig()
DEFAULT_RETRY = RetryConfig()


def build_httpx_timeout(cfg: TimeoutConfig) -> httpx.Timeout:
    return httpx.Timeout(
        connect=cfg.connect_timeout,
        read=cfg.read_timeout,
        write=cfg.connect_timeout,
        pool=cfg.total_timeout,
    )


def _backoff_delay(attempt: int, cfg: RetryConfig) -> float:
    delay = min(cfg.base_delay * (2 ** attempt), cfg.max_delay)
    if cfg.jitter:
        delay *= (0.5 + random.random() * 0.5)
    return delay


async def execute_with_retry(
    fn: Callable[[], Coroutine[Any, Any, Any]],
    retry_cfg: RetryConfig = DEFAULT_RETRY,
) -> tuple[Any, int]:
    """
    Execute an async callable with retry logic.
    Returns (result, retry_count).
    Only retries on retryable network errors; non-retryable exceptions propagate immediately.
    """
    last_exc: Exception | None = None
    for attempt in range(retry_cfg.max_retries + 1):
        try:
            result = await fn()
            return result, attempt
        except Exception as exc:
            last_exc = exc
            if not is_retryable_error(exc):
                raise
            if attempt < retry_cfg.max_retries:
                delay = _backoff_delay(attempt, retry_cfg)
                logger.debug(
                    "Retry attempt %d/%d after %.2fs (reason: %s)",
                    attempt + 1, retry_cfg.max_retries, delay, type(exc).__name__,
                )
                await asyncio.sleep(delay)

    raise last_exc  # type: ignore[misc]
