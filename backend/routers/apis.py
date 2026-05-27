from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
import httpx

from middleware.auth import get_current_user
from supabase_client import get_supabase

router = APIRouter()


class ApiCreate(BaseModel):
    name: str
    url: str
    method: str = "GET"
    headers: Dict[str, str] = {}
    body: Optional[Dict[str, Any]] = None
    timeout: int = 5000
    retries: int = 3
    interval_seconds: int = 60
    expected_status: int = 200
    tags: List[str] = []


class ApiUpdate(ApiCreate):
    is_active: Optional[bool] = None


@router.get("/")
async def list_apis(user=Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("apis").select("*").eq("user_id", user["id"]).order("created_at", desc=True).execute()
    return res.data


@router.post("/")
async def create_api(data: ApiCreate, user=Depends(get_current_user)):
    sb = get_supabase()
    payload = data.dict()
    payload["user_id"] = user["id"]
    res = sb.table("apis").insert(payload).execute()
    return res.data[0] if res.data else {}


@router.put("/{api_id}")
async def update_api(api_id: str, data: ApiUpdate, user=Depends(get_current_user)):
    sb = get_supabase()
    payload = {k: v for k, v in data.dict().items() if v is not None}
    payload["updated_at"] = datetime.utcnow().isoformat()
    res = sb.table("apis").update(payload).eq("id", api_id).eq("user_id", user["id"]).execute()
    return res.data[0] if res.data else {}


@router.delete("/{api_id}")
async def delete_api(api_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    sb.table("apis").delete().eq("id", api_id).eq("user_id", user["id"]).execute()
    return {"deleted": True}


@router.post("/{api_id}/check")
async def check_api(api_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    api_res = sb.table("apis").select("*").eq("id", api_id).eq("user_id", user["id"]).single().execute()
    if not api_res.data:
        raise HTTPException(status_code=404, detail="API not found")
    api = api_res.data

    start = datetime.utcnow()
    result = {"status": "error", "status_code": None, "latency_ms": 0, "error_message": ""}

    for attempt in range(api.get("retries", 1) + 1):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.request(
                    method=api["method"],
                    url=api["url"],
                    headers=api.get("headers", {}),
                    timeout=api.get("timeout", 5000) / 1000,
                )
            latency = int((datetime.utcnow() - start).total_seconds() * 1000)
            result = {
                "status": "success" if resp.status_code == api.get("expected_status", 200) else "error",
                "status_code": resp.status_code,
                "latency_ms": latency,
                "error_message": "" if resp.status_code == api.get("expected_status", 200) else f"Expected {api.get('expected_status')}, got {resp.status_code}",
            }
            break
        except Exception as e:
            latency = int((datetime.utcnow() - start).total_seconds() * 1000)
            result = {"status": "error", "status_code": None, "latency_ms": latency, "error_message": str(e)}

    log_payload = {**result, "api_id": api_id, "user_id": user["id"], "checked_at": datetime.utcnow().isoformat()}
    sb.table("api_logs").insert(log_payload).execute()

    total = api.get("total_checks", 0) + 1
    failed = api.get("failed_checks", 0) + (1 if result["status"] == "error" else 0)
    uptime = round(((total - failed) / total) * 100, 2) if total > 0 else 100.0

    sb.table("apis").update({
        "last_status": result["status"],
        "last_latency_ms": result["latency_ms"],
        "last_checked_at": datetime.utcnow().isoformat(),
        "total_checks": total,
        "failed_checks": failed,
        "uptime_percent": uptime,
    }).eq("id", api_id).execute()

    return result
