from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from middleware.auth import get_current_user
from supabase_client import get_supabase
from datetime import datetime

router = APIRouter()


class WorkflowCreate(BaseModel):
    name: str
    description: str = ""
    api_ids: List[str]
    merge_strategy: str = "merge"
    response_template: Dict[str, Any] = {}


@router.get("/")
async def list_workflows(user=Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("workflows").select("*").eq("user_id", user["id"]).order("created_at", desc=True).execute()
    return res.data


@router.post("/")
async def create_workflow(data: WorkflowCreate, user=Depends(get_current_user)):
    sb = get_supabase()
    slug = f"{data.name.lower().replace(' ', '-')}-{int(datetime.utcnow().timestamp())}"
    payload = data.dict()
    payload["user_id"] = user["id"]
    payload["endpoint_slug"] = slug
    res = sb.table("workflows").insert(payload).execute()
    return res.data[0] if res.data else {}


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    sb.table("workflows").delete().eq("id", workflow_id).eq("user_id", user["id"]).execute()
    return {"deleted": True}
