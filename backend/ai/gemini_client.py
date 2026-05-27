import httpx
import json
import logging
from typing import Optional

from services.ai_credentials_service import get_ai_credentials, AICredentials

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"


async def _call_gemini_api(prompt: str, api_key: str, temperature: float = 0.3, max_tokens: int = 500) -> str:
    """Internal helper to make Gemini API call. Returns raw text response."""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{GEMINI_URL}?key={api_key}", json=payload)
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


def _strip_markdown(text: str) -> str:
    """Strip markdown code blocks from response if present."""
    if "```json" in text:
        return text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        return text.split("```")[1].split("```")[0].strip()
    return text


async def generate_fallback(failure_reason: str, api_context: str = "", user_id: Optional[str] = None) -> dict:
    """
    Generate a fallback response using Gemini.

    Args:
        failure_reason: The error message from failed API
        api_context: Additional context about the API
        user_id: Optional user ID for BYOK support

    Returns:
        Parsed JSON fallback response
    """
    prompt = f"""An API failed: {failure_reason}. Context: {api_context}.
Generate a structured JSON fallback response with status, message, data, explanation, and retry_after fields.
Respond ONLY with valid JSON."""

    creds = get_ai_credentials(user_id)
    if not creds.gemini_key:
        raise ValueError("No Gemini API key available (user or platform)")

    try:
        text = await _call_gemini_api(prompt, creds.gemini_key, temperature=0.3, max_tokens=500)
        cleaned = _strip_markdown(text)
        result = json.loads(cleaned)
        result["provider"] = "gemini"
        result["provider_source"] = creds.gemini_source
        return result
    except Exception as exc:
        logger.error(f"Gemini API call failed (source={creds.gemini_source}): {exc}")
        raise


async def generate_format(description: str, user_id: Optional[str] = None) -> str:
    """
    Generate an integration format/schema using Gemini.

    Args:
        description: User's format description
        user_id: Optional user ID for BYOK support

    Returns:
        JSON string format definition
    """
    prompt = f"""Generate a JSON integration format and schema for: {description}
Include request structure, response schema, and example code. Respond with clean JSON."""

    creds = get_ai_credentials(user_id)
    if not creds.gemini_key:
        raise ValueError("No Gemini API key available (user or platform)")

    try:
        text = await _call_gemini_api(prompt, creds.gemini_key, temperature=0.4, max_tokens=1000)
        return text
    except Exception as exc:
        logger.error(f"Gemini API call failed (source={creds.gemini_source}): {exc}")
        raise


async def validate_gemini_key(api_key: str) -> dict:
    """
    Validate a Gemini API key by making a lightweight test request.

    Args:
        api_key: The Gemini API key to validate

    Returns:
        {"valid": bool, "error": Optional[str]}
    """
    try:
        # Minimal request to check if key is valid
        await _call_gemini_api("Say OK", api_key, temperature=0, max_tokens=10)
        return {"valid": True, "error": None}
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 400:
            return {"valid": False, "error": "Invalid API key"}
        elif exc.response.status_code == 403:
            return {"valid": False, "error": "API key not authorized or quota exceeded"}
        else:
            return {"valid": False, "error": f"HTTP {exc.response.status_code}"}
    except Exception as exc:
        return {"valid": False, "error": str(exc)}
