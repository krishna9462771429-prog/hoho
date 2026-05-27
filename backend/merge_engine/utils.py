import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def utc_now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def safe_json_parse(raw: Any) -> Optional[Any]:
    if isinstance(raw, (dict, list)):
        return raw
    if not isinstance(raw, (str, bytes)):
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None


def response_size_bytes(data: Any) -> int:
    try:
        if data is None:
            return 0
        if isinstance(data, (str, bytes)):
            return len(data.encode() if isinstance(data, str) else data)
        return len(json.dumps(data).encode())
    except Exception:
        return 0


def flatten_dict(obj: Dict[str, Any], prefix: str = "", sep: str = ".") -> Dict[str, Any]:
    """Flatten nested dicts into dot-notation keys."""
    result: Dict[str, Any] = {}
    for key, value in obj.items():
        full_key = f"{prefix}{sep}{key}" if prefix else key
        if isinstance(value, dict):
            result.update(flatten_dict(value, full_key, sep))
        else:
            result[full_key] = value
    return result


def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively merge two dicts; override wins on scalar conflicts."""
    result = dict(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def is_retryable_error(exc: Exception) -> bool:
    import httpx
    return isinstance(exc, (
        httpx.ConnectTimeout,
        httpx.ReadTimeout,
        httpx.ConnectError,
        httpx.RemoteProtocolError,
    ))


def classify_timeout(exc: Exception) -> str:
    import httpx
    if isinstance(exc, httpx.ConnectTimeout):
        return "connect_timeout"
    if isinstance(exc, httpx.ReadTimeout):
        return "read_timeout"
    if isinstance(exc, httpx.PoolTimeout):
        return "pool_timeout"
    return "timeout"
