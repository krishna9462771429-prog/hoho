from fastapi import APIRouter, Depends
from middleware.auth import get_current_user
from supabase_client import get_supabase
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/overview")
async def analytics_overview(days: int = 30, user=Depends(get_current_user)):
    sb = get_supabase()
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()

    logs_res = sb.table("api_logs").select("*").eq("user_id", user["id"]).gte("checked_at", since).execute()
    fallbacks_res = sb.table("ai_fallbacks").select("*").eq("user_id", user["id"]).gte("created_at", since).execute()

    logs = logs_res.data or []
    fallbacks = fallbacks_res.data or []

    total = len(logs)
    success = sum(1 for l in logs if l.get("status") == "success")
    errors = total - success
    avg_latency = int(sum(l.get("latency_ms", 0) for l in logs) / total) if total else 0

    daily: dict = {}
    for log in logs:
        day = log["checked_at"][:10]
        if day not in daily:
            daily[day] = {"date": day, "success": 0, "errors": 0, "latency_sum": 0, "count": 0}
        daily[day]["count"] += 1
        if log.get("status") == "success":
            daily[day]["success"] += 1
        else:
            daily[day]["errors"] += 1
        daily[day]["latency_sum"] += log.get("latency_ms", 0)

    daily_list = [
        {
            "date": v["date"],
            "success": v["success"],
            "errors": v["errors"],
            "latency": int(v["latency_sum"] / v["count"]) if v["count"] else 0,
        }
        for v in sorted(daily.values(), key=lambda x: x["date"])
    ]

    provider_counts: dict = {}
    for f in fallbacks:
        p = f.get("provider", "unknown")
        provider_counts[p] = provider_counts.get(p, 0) + 1

    return {
        "total_requests": total,
        "successful": success,
        "errors": errors,
        "avg_latency_ms": avg_latency,
        "ai_fallbacks": len(fallbacks),
        "success_rate": round((success / total) * 100, 2) if total else 100.0,
        "daily": daily_list,
        "provider_usage": [{"name": k, "value": v} for k, v in provider_counts.items()],
    }
