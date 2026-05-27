"""
Schema normalization and conflict resolution engine.

Handles:
- Alias / field-name harmonization (temperature ↔ temp, user_id ↔ userId, etc.)
- Nested object flattening (optional)
- Type coercion (string "28" → int 28)
- Numeric conflict resolution (average, first_wins, last_wins, majority)
- String / null conflict resolution
"""

from collections import Counter
from typing import Any, Dict, List, Optional
import statistics

from .models import ConflictResolution

# Common alias groups: keys in the same list are considered the same field.
# The *first* key in each group is the canonical name.
_ALIAS_GROUPS: List[List[str]] = [
    ["temperature", "temp", "temperature_celsius", "temp_c"],
    ["humidity", "hum", "humidity_percent"],
    ["user_id", "userId", "user", "uid", "account_id"],
    ["name", "full_name", "fullName", "display_name", "displayName"],
    ["email", "email_address", "emailAddress"],
    ["price", "amount", "cost", "value", "total"],
    ["latitude", "lat"],
    ["longitude", "lon", "lng"],
    ["timestamp", "ts", "time", "created_at", "createdAt", "date"],
    ["status", "state", "condition"],
    ["message", "msg", "description", "detail"],
    ["count", "total", "num", "number"],
    ["id", "identifier", "record_id", "recordId"],
]

# Build lookup: alias_key → canonical_key
_ALIAS_MAP: Dict[str, str] = {}
for group in _ALIAS_GROUPS:
    canonical = group[0]
    for alias in group[1:]:
        _ALIAS_MAP[alias] = canonical


def _canonical_key(key: str) -> str:
    return _ALIAS_MAP.get(key, key)


def _coerce_value(value: Any) -> Any:
    """Attempt lightweight type coercion."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        try:
            return int(stripped)
        except ValueError:
            pass
        try:
            return float(stripped)
        except ValueError:
            pass
        if stripped.lower() in ("true", "yes"):
            return True
        if stripped.lower() in ("false", "no"):
            return False
    return value


def _resolve_conflict(
    canonical: str,
    values: List[Any],
    strategy: ConflictResolution,
) -> Any:
    """Pick a winner when multiple APIs return different values for the same field."""
    # Filter out None/null; prefer non-null unless all are null
    non_null = [v for v in values if v is not None]
    if not non_null:
        return None

    if strategy == ConflictResolution.FIRST_WINS:
        return non_null[0]

    if strategy == ConflictResolution.LAST_WINS:
        return non_null[-1]

    if strategy == ConflictResolution.MAJORITY:
        try:
            counter = Counter(str(v) for v in non_null)
            most_common_str = counter.most_common(1)[0][0]
            # Return first value whose str() matches
            for v in non_null:
                if str(v) == most_common_str:
                    return v
        except Exception:
            pass
        return non_null[0]

    # AVERAGE — only meaningful for numerics; fall back to first_wins otherwise
    numeric = [v for v in non_null if isinstance(v, (int, float))]
    if numeric and len(numeric) == len(non_null):
        avg = statistics.mean(numeric)
        # Return int if all source values were int
        if all(isinstance(v, int) for v in numeric):
            return round(avg)
        return round(avg, 6)

    # Mixed types or strings — use majority
    counter = Counter(str(v) for v in non_null)
    most_common_str = counter.most_common(1)[0][0]
    for v in non_null:
        if str(v) == most_common_str:
            return v
    return non_null[0]


def _normalize_object(obj: Any) -> Any:
    """Recursively canonicalize keys and coerce leaf values."""
    if isinstance(obj, dict):
        result: Dict[str, Any] = {}
        for key, val in obj.items():
            canonical = _canonical_key(key)
            result[canonical] = _normalize_object(val)
        return result
    if isinstance(obj, list):
        return [_normalize_object(item) for item in obj]
    return _coerce_value(obj)


def normalize_responses(
    responses: List[Any],
    conflict_resolution: ConflictResolution = ConflictResolution.AVERAGE,
) -> Any:
    """
    Given a list of successful JSON responses, normalize and merge them into
    a single unified object.

    - Each response is individually key-canonicalized + value-coerced.
    - Conflicting scalar values for the same canonical key are resolved
      according to `conflict_resolution`.
    - Non-conflicting keys are merged as-is.
    - Non-dict responses (arrays, primitives) are wrapped and included as-is.
    """
    dicts: List[Dict[str, Any]] = []
    non_dicts: List[Any] = []

    for resp in responses:
        if resp is None:
            continue
        normalized = _normalize_object(resp)
        if isinstance(normalized, dict):
            dicts.append(normalized)
        else:
            non_dicts.append(normalized)

    if not dicts and not non_dicts:
        return {}

    if not dicts:
        return non_dicts if len(non_dicts) > 1 else non_dicts[0]

    # Collect all keys across all dicts
    all_keys: set[str] = set()
    for d in dicts:
        all_keys.update(d.keys())

    merged: Dict[str, Any] = {}
    for key in all_keys:
        values = [d[key] for d in dicts if key in d]
        if len(values) == 1:
            merged[key] = values[0]
            continue

        # All values identical → no conflict
        if all(v == values[0] for v in values):
            merged[key] = values[0]
            continue

        # Recurse into nested dicts
        if all(isinstance(v, dict) for v in values):
            merged[key] = normalize_responses(values, conflict_resolution)
            continue

        merged[key] = _resolve_conflict(key, values, conflict_resolution)

    if non_dicts:
        merged["_array_responses"] = non_dicts

    return merged
