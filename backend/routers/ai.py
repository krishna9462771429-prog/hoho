from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from middleware.auth import get_current_user
from supabase_client import get_supabase
from ai.groq_client import generate_fallback as groq_fallback, generate_workflow, validate_groq_key
from ai.gemini_client import generate_fallback as gemini_fallback, generate_format, validate_gemini_key
from ai.failure_diagnosis import diagnose_failure, categorize_failure
from services.diagnosis_service import create_diagnosis, get_diagnoses_for_api, get_diagnosis_stats
from services.ai_credentials_service import get_ai_credentials_masked

router = APIRouter()


class FallbackRequest(BaseModel):
    failure_reason: str
    api_context: str = ""
    api_id: Optional[str] = None
    provider: str = "groq"
    user_id: Optional[str] = None


class GenerateRequest(BaseModel):
    prompt: str
    type: str = "workflow"


class DiagnoseRequest(BaseModel):
    api_name: str
    url: str
    status_code: Optional[int] = None
    error_message: str
    latency_ms: int
    api_id: Optional[str] = None
    previous_logs: Optional[List[Dict[str, Any]]] = None


class ValidateKeyRequest(BaseModel):
    provider: str
    api_key: str


class UpdateBYOKRequest(BaseModel):
    use_personal_ai_keys: bool
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None


@router.post("/fallback")
async def ai_fallback(req: FallbackRequest):
    sb = get_supabase()
    from datetime import datetime
    start = datetime.utcnow()
    result = None
    used_provider = req.provider

    try:
        if req.provider == "groq":
            result = await groq_fallback(req.failure_reason, req.api_context, req.user_id)
        else:
            result = await gemini_fallback(req.failure_reason, req.api_context, req.user_id)
    except Exception:
        try:
            if req.provider == "groq":
                result = await gemini_fallback(req.failure_reason, req.api_context, req.user_id)
                used_provider = "gemini"
            else:
                result = await groq_fallback(req.failure_reason, req.api_context, req.user_id)
                used_provider = "groq"
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"All AI providers failed: {str(e)}")

    latency = int((datetime.utcnow() - start).total_seconds() * 1000)

    if req.user_id:
        sb.table("ai_fallbacks").insert({
            "user_id": req.user_id,
            "api_id": req.api_id,
            "provider": used_provider,
            "failure_reason": req.failure_reason,
            "response": result,
            "latency_ms": latency,
        }).execute()

    return {"provider": used_provider, "response": result, "latency_ms": latency}


@router.post("/generate")
async def generate(req: GenerateRequest, user=Depends(get_current_user)):
    try:
        if req.type in ("workflow",):
            content = await generate_workflow(req.prompt, user["id"])
        elif req.type == "format":
            content = await generate_format(req.prompt, user["id"])
        else:
            content = await generate_workflow(req.prompt, user["id"])
        return {"result": content, "type": req.type}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/diagnose")
async def diagnose(req: DiagnoseRequest, user=Depends(get_current_user)):
    if not req.api_id:
        diagnosis_result = await diagnose_failure(
            api_name=req.api_name,
            url=req.url,
            status_code=req.status_code,
            error_message=req.error_message,
            latency_ms=req.latency_ms,
            previous_logs=req.previous_logs or [],
        )
        return diagnosis_result

    diagnosis_record = await create_diagnosis(
        user_id=user["id"],
        api_id=req.api_id,
        api_name=req.api_name,
        url=req.url,
        status_code=req.status_code,
        error_message=req.error_message,
        latency_ms=req.latency_ms,
    )

    return diagnosis_record


@router.get("/diagnoses/{api_id}")
async def get_diagnoses(api_id: str, limit: int = 10, user=Depends(get_current_user)):
    diagnoses = await get_diagnoses_for_api(api_id, user["id"], limit)
    return {"diagnoses": diagnoses, "count": len(diagnoses)}


@router.get("/diagnoses")
async def list_all_diagnoses(limit: int = 50, user=Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("failure_diagnoses").select("*").eq("user_id", user["id"]).order("created_at", desc=True).limit(limit).execute()
    return {"diagnoses": res.data or [], "count": len(res.data or [])}


@router.get("/diagnosis-stats")
async def diagnosis_stats(user=Depends(get_current_user)):
    stats = await get_diagnosis_stats(user["id"])
    return stats


@router.post("/categorize")
async def categorize(req: DiagnoseRequest):
    category = categorize_failure(req.status_code, req.error_message)
    return {"category": category, "error_message": req.error_message, "status_code": req.status_code}


# ──────────────────────────────────────────────
# BYOK (Bring Your Own Key) Endpoints
# ──────────────────────────────────────────────

@router.get("/byok/credentials")
async def get_byok_credentials(user=Depends(get_current_user)):
    """
    Get masked AI credentials for the current user.
    Keys are never returned in full - always masked.
    """
    creds = get_ai_credentials_masked(user["id"])
    return creds


@router.post("/byok/validate")
async def validate_byok_key(req: ValidateKeyRequest):
    """
    Validate an API key without storing it.
    Returns validation result without exposing secrets.
    """
    if req.provider == "groq":
        result = await validate_groq_key(req.api_key)
    elif req.provider == "gemini":
        result = await validate_gemini_key(req.api_key)
    else:
        raise HTTPException(status_code=400, detail="Invalid provider. Use 'groq' or 'gemini'.")

    return {"provider": req.provider, **result}


@router.post("/byok/update")
async def update_byok_keys(req: UpdateBYOKRequest, user=Depends(get_current_user)):
    """
    Update user's personal AI keys settings.
    Keys are stored securely and never logged.
    """
    sb = get_supabase()
    from datetime import datetime, timezone

    # Check if user_settings exists
    existing = sb.table("user_settings").select("id").eq("user_id", user["id"]).maybeSingle().execute()

    # Build update payload - only include non-None keys to avoid overwriting
    payload: Dict[str, Any] = {
        "use_personal_ai_keys": req.use_personal_ai_keys,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Only update keys if provided (allows partial updates)
    if req.groq_api_key is not None:
        payload["groq_api_key"] = req.groq_api_key
    if req.gemini_api_key is not None:
        payload["gemini_api_key"] = req.gemini_api_key

    try:
        if existing.data:
            sb.table("user_settings").update(payload).eq("user_id", user["id"]).execute()
        else:
            # Create new settings record
            payload["user_id"] = user["id"]
            sb.table("user_settings").insert(payload).execute()

        # Return masked credentials after update
        creds = get_ai_credentials_masked(user["id"])
        return {"success": True, **creds}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(exc)}")


@router.delete("/byok/key/{provider}")
async def delete_byok_key(provider: str, user=Depends(get_current_user)):
    """
    Delete a specific personal API key (set to NULL).
    """
    if provider not in ("groq", "gemini"):
        raise HTTPException(status_code=400, detail="Invalid provider. Use 'groq' or 'gemini'.")

    sb = get_supabase()
    from datetime import datetime, timezone

    column = f"{provider}_api_key"
    payload = {
        column: None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        sb.table("user_settings").update(payload).eq("user_id", user["id"]).execute()
        creds = get_ai_credentials_masked(user["id"])
        return {"success": True, **creds}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete key: {str(exc)}")
