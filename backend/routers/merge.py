from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import asyncio
from datetime import datetime

from supabase_client import get_supabase

router = APIRouter()


class MergeRequest(BaseModel):
    api_ids: List[str]
    strategy: str = "merge"
    user_id: Optional[str] = None


@router.post("/execute")
async def execute_merge(req: MergeRequest):
    sb = get_supabase()
    apis_res = sb.table("apis").select("*").in_("id", req.api_ids).execute()
    if not apis_res.data:
        raise HTTPException(status_code=404, detail="No APIs found")

    apis = apis_res.data

    async def call_api(api: dict) -> Dict[str, Any]:
        start = datetime.utcnow()
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.request(
                    method=api["method"],
                    url=api["url"],
                    headers=api.get("headers", {}),
                    timeout=api.get("timeout", 5000) / 1000,
                )
            latency = int((datetime.utcnow() - start).total_seconds() * 1000)
            try:
                body = resp.json()
            except Exception:
                body = resp.text
            return {"api": api["name"], "status": resp.status_code, "latency_ms": latency, "data": body, "success": True}
        except Exception as e:
            latency = int((datetime.utcnow() - start).total_seconds() * 1000)
            return {"api": api["name"], "status": None, "latency_ms": latency, "error": str(e), "success": False}

    results = await asyncio.gather(*[call_api(api) for api in apis])

    if req.strategy == "first_success":
        for r in results:
            if r["success"]:
                return {"strategy": req.strategy, "result": r}
        raise HTTPException(status_code=503, detail="All APIs failed")

    merged: Dict[str, Any] = {}
    for r in results:
        merged[r["api"]] = r

    return {"strategy": req.strategy, "merged": merged, "count": len(results)}


@router.get("/{slug}")
async def execute_by_slug(slug: str):
    sb = get_supabase()
    wf_res = sb.table("workflows").select("*").eq("endpoint_slug", slug).eq("is_active", True).single().execute()
    if not wf_res.data:
        raise HTTPException(status_code=404, detail="Workflow not found")

    wf = wf_res.data
    apis_res = sb.table("apis").select("*").in_("id", wf["api_ids"]).execute()

    if not apis_res.data:
        raise HTTPException(status_code=404, detail="No APIs configured")

    async def call_api(api: dict):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.request(
                    method=api["method"], url=api["url"],
                    headers=api.get("headers", {}),
                    timeout=api.get("timeout", 5000) / 1000,
                )
            try:
                return {"api": api["name"], "data": resp.json(), "status": resp.status_code}
            except Exception:
                return {"api": api["name"], "data": resp.text, "status": resp.status_code}
        except Exception as e:
            return {"api": api["name"], "error": str(e), "status": None}

    results = await asyncio.gather(*[call_api(api) for api in apis_res.data])
    merged = {r["api"]: r for r in results}

    sb.table("workflows").update({"total_calls": wf["total_calls"] + 1}).eq("id", wf["id"]).execute()

    return {"workflow": wf["name"], "slug": slug, "merged": merged}
