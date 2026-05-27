from fastapi import APIRouter, Depends
from middleware.auth import get_current_user
from supabase_client import get_supabase

router = APIRouter()


@router.get("/logs")
async def get_logs(
    limit: int = 50,
    offset: int = 0,
    status: str = None,
    api_id: str = None,
    user=Depends(get_current_user)
):
    sb = get_supabase()
    query = sb.table("api_logs").select("*").eq("user_id", user["id"]).order("checked_at", desc=True)
    if status:
        query = query.eq("status", status)
    if api_id:
        query = query.eq("api_id", api_id)
    query = query.range(offset, offset + limit - 1)
    res = query.execute()
    return {"logs": res.data, "count": len(res.data)}


@router.get("/stats")
async def get_stats(user=Depends(get_current_user)):
    sb = get_supabase()
    apis_res = sb.table("apis").select("*").eq("user_id", user["id"]).execute()
    apis = apis_res.data or []

    total_apis = len(apis)
    active_apis = sum(1 for a in apis if a.get("is_active"))
    avg_uptime = sum(a.get("uptime_percent", 0) for a in apis) / total_apis if total_apis else 100.0

    from datetime import date
    today = date.today().isoformat()
    logs_res = sb.table("api_logs").select("*").eq("user_id", user["id"]).gte("checked_at", today).execute()
    logs = logs_res.data or []
    failed_today = sum(1 for l in logs if l.get("status") == "error")
    fallbacks_today = sum(1 for l in logs if l.get("is_fallback"))
    avg_latency = int(sum(l.get("latency_ms", 0) for l in logs) / len(logs)) if logs else 0

    return {
        "total_apis": total_apis,
        "active_apis": active_apis,
        "avg_uptime": round(avg_uptime, 2),
        "total_checks_today": len(logs),
        "failed_checks_today": failed_today,
        "ai_fallbacks_today": fallbacks_today,
        "avg_latency_ms": avg_latency,
    }
