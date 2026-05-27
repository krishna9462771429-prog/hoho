"""
Merge strategy implementations.

Each strategy receives a list of ApiCallResult objects and a ConflictResolution
policy, and returns (merged_data, success_flag).

Strategies:
  merge            – merge all successful responses; tolerate partial failures
  first_success    – return the first successful response immediately
  all_required     – fail if any API fails
  majority_success – succeed if > 50% of APIs succeed
  fallback_chain   – execute sequentially; return first success
"""

from typing import Any, Dict, List, Optional, Tuple

from .models import ApiCallResult, ConflictResolution, MergeStrategy
from .normalizer import normalize_responses


def _successful_data(results: List[ApiCallResult]) -> List[Any]:
    return [r.data for r in results if r.success and r.data is not None]


def _build_errors(results: List[ApiCallResult]) -> List[Dict[str, Any]]:
    return [
        {
            "api_id": r.api_id,
            "api_name": r.api_name,
            "error": r.error,
            "status_code": r.status_code,
            "latency_ms": r.latency_ms,
            "retry_count": r.retry_count,
            "timeout_type": r.timeout_type,
        }
        for r in results
        if not r.success
    ]


def apply_strategy(
    results: List[ApiCallResult],
    strategy: MergeStrategy,
    conflict_resolution: ConflictResolution,
    normalize: bool,
) -> Tuple[Optional[Any], bool, List[Dict[str, Any]]]:
    """
    Returns (merged_data, overall_success, error_list).
    """
    errors = _build_errors(results)
    successes = [r for r in results if r.success]
    total = len(results)

    if strategy == MergeStrategy.ALL_REQUIRED:
        if len(successes) < total:
            return None, False, errors
        data = _merge_data(successes, conflict_resolution, normalize)
        return data, True, []

    if strategy == MergeStrategy.FIRST_SUCCESS:
        if not successes:
            return None, False, errors
        first = successes[0]
        return first.data, True, errors

    if strategy == MergeStrategy.MAJORITY_SUCCESS:
        threshold = total / 2
        if len(successes) <= threshold:
            return None, False, errors
        data = _merge_data(successes, conflict_resolution, normalize)
        return data, True, errors

    if strategy == MergeStrategy.FALLBACK_CHAIN:
        # Results are already in sequential order
        if not successes:
            return None, False, errors
        first = successes[0]
        return first.data, True, errors

    # Default: MERGE — tolerate failures, include all successful data
    if not successes:
        return None, False, errors
    data = _merge_data(successes, conflict_resolution, normalize)
    return data, True, errors


def _merge_data(
    successes: List[ApiCallResult],
    conflict_resolution: ConflictResolution,
    normalize: bool,
) -> Any:
    if len(successes) == 1:
        return successes[0].data

    payloads = [r.data for r in successes if r.data is not None]
    if not payloads:
        return {}

    if normalize:
        return normalize_responses(payloads, conflict_resolution)

    # Raw merge without normalization: key by api_name
    merged: Dict[str, Any] = {}
    for result in successes:
        merged[result.api_name] = result.data
    return merged
