from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import httpx

from middleware.auth import get_current_user
from supabase_client import get_supabase

router = APIRouter()


class TickerCreate(BaseModel):
    name: str
    url: str
    interval_seconds: int = 300


@router.get("/")
async def list_tickers(user=Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("ticker_services").select("*").eq("user_id", user["id"]).execute()
    return res.data


@router.post("/")
async def create_ticker(data: TickerCreate, user=Depends(get_current_user)):
    sb = get_supabase()
    payload = data.dict()
    payload["user_id"] = user["id"]
    res = sb.table("ticker_services").insert(payload).execute()
    return res.data[0] if res.data else {}


@router.post("/{ticker_id}/ping")
async def ping_ticker(ticker_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("ticker_services").select("*").eq("id", ticker_id).eq("user_id", user["id"]).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Ticker not found")

    service = res.data
    start = datetime.utcnow()
    status = "error"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.get(service["url"])
        status = "success"
    except Exception:
        status = "error"

    latency = int((datetime.utcnow() - start).total_seconds() * 1000)
    sb.table("ticker_services").update({
        "last_pinged_at": datetime.utcnow().isoformat(),
        "last_status": status,
        "ping_count": service["ping_count"] + 1,
    }).eq("id", ticker_id).execute()

    return {"status": status, "latency_ms": latency}


@router.delete("/{ticker_id}")
async def delete_ticker(ticker_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    sb.table("ticker_services").delete().eq("id", ticker_id).eq("user_id", user["id"]).execute()
    return {"deleted": True}
