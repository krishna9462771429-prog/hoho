from typing import Dict, Any, List, Optional
from datetime import datetime

from supabase_client import get_supabase
from ai.failure_diagnosis import diagnose_failure


async def create_diagnosis(
    user_id: str,
    api_id: str,
    api_name: str,
    url: str,
    status_code: Optional[int],
    error_message: str,
    latency_ms: int,
) -> Dict[str, Any]:
    sb = get_supabase()

    previous_logs_res = sb.table("api_logs").select("*").eq("api_id", api_id).eq("status", "error").order("checked_at", desc=True).limit(10).execute()
    previous_logs = previous_logs_res.data or []

    diagnosis_result = await diagnose_failure(
        api_name=api_name,
        url=url,
        status_code=status_code,
        error_message=error_message,
        latency_ms=latency_ms,
        previous_logs=previous_logs,
    )

    raw_error = {
        "status_code": status_code,
        "error_message": error_message,
        "latency_ms": latency_ms,
        "timestamp": datetime.utcnow().isoformat(),
    }

    insert_payload = {
        "user_id": user_id,
        "api_id": api_id,
        "diagnosis": diagnosis_result.get("diagnosis", ""),
        "severity": diagnosis_result.get("severity", "medium"),
        "confidence": diagnosis_result.get("confidence", 0.7),
        "suggested_fix": diagnosis_result.get("suggested_fix", ""),
        "recommended_action": diagnosis_result.get("recommended_action", "investigate"),
        "provider_used": diagnosis_result.get("provider_used", "groq"),
        "raw_error": raw_error,
        "failure_category": diagnosis_result.get("failure_category", "unknown"),
    }

    res = sb.table("failure_diagnoses").insert(insert_payload).execute()

    if res.data:
        diagnosis_record = res.data[0]
        diagnosis_record["explanation"] = diagnosis_result.get("explanation", "")
        return diagnosis_record

    return diagnosis_result


async def get_diagnoses_for_api(api_id: str, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    sb = get_supabase()
    res = sb.table("failure_diagnoses").select("*").eq("api_id", api_id).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
    return res.data or []


async def get_diagnosis_stats(user_id: str) -> Dict[str, Any]:
    sb = get_supabase()
    res = sb.table("failure_diagnoses").select("*").eq("user_id", user_id).execute()
    diagnoses = res.data or []

    total = len(diagnoses)
    if total == 0:
        return {
            "total": 0,
            "by_severity": {},
            "by_category": {},
            "by_action": {},
            "avg_confidence": 0.0,
        }

    by_severity: Dict[str, int] = {}
    by_category: Dict[str, int] = {}
    by_action: Dict[str, int] = {}
    total_confidence = 0.0

    for d in diagnoses:
        sev = d.get("severity", "unknown")
        by_severity[sev] = by_severity.get(sev, 0) + 1

        cat = d.get("failure_category", "unknown")
        by_category[cat] = by_category.get(cat, 0) + 1

        action = d.get("recommended_action", "unknown")
        by_action[action] = by_action.get(action, 0) + 1

        total_confidence += float(d.get("confidence", 0))

    return {
        "total": total,
        "by_severity": by_severity,
        "by_category": by_category,
        "by_action": by_action,
        "avg_confidence": round(total_confidence / total, 3),
    }
