import httpx
import json
import logging
from typing import Optional

from services.ai_credentials_service import get_ai_credentials, AICredentials

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"


async def _call_groq_api(prompt: str, api_key: str, temperature: float = 0.3, max_tokens: int = 500) -> dict:
    """Internal helper to make Groq API call."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(GROQ_API_URL, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def generate_fallback(failure_reason: str, api_context: str = "", user_id: Optional[str] = None) -> dict:
    """
    Generate a fallback response using Groq.

    Args:
        failure_reason: The error message from failed API
        api_context: Additional context about the API
        user_id: Optional user ID for BYOK support

    Returns:
        Parsed JSON fallback response
    """
    prompt = f"""You are an API reliability AI assistant.
An API has failed with the following error: {failure_reason}
API context: {api_context or 'Unknown API'}

Generate a structured JSON fallback response that:
1. Acknowledges the failure gracefully
2. Provides a helpful mock/cached response where possible
3. Includes an explanation of the failure
4. Suggests when to retry

Respond ONLY with valid JSON in this format:
{{
  "status": "fallback",
  "provider": "groq",
  "message": "description of the situation",
  "data": {{}},
  "explanation": "why the API failed",
  "retry_after": 30,
  "fallback": true
}}"""

    creds = get_ai_credentials(user_id)
    if not creds.groq_key:
        raise ValueError("No Groq API key available (user or platform)")

    try:
        result = await _call_groq_api(prompt, creds.groq_key, temperature=0.3, max_tokens=500)
        content = result["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        parsed["provider_source"] = creds.groq_source
        return parsed
    except Exception as exc:
        logger.error(f"Groq API call failed (source={creds.groq_source}): {exc}")
        raise


async def generate_workflow(description: str, user_id: Optional[str] = None) -> str:
    """
    Generate a workflow plan using Groq.

    Args:
        description: User's workflow description
        user_id: Optional user ID for BYOK support

    Returns:
        JSON string workflow definition
    """
    prompt = f"""You are an API workflow architect AI.
The user wants: {description}

Generate a detailed JSON API workflow plan including:
- Step-by-step API sequence
- Request/response schemas
- Error handling
- Merge strategy
- Integration example

Respond with clean, well-structured JSON."""

    creds = get_ai_credentials(user_id)
    if not creds.groq_key:
        raise ValueError("No Groq API key available (user or platform)")

    try:
        result = await _call_groq_api(prompt, creds.groq_key, temperature=0.4, max_tokens=1000)
        return result["choices"][0]["message"]["content"]
    except Exception as exc:
        logger.error(f"Groq API call failed (source={creds.groq_source}): {exc}")
        raise


async def validate_groq_key(api_key: str) -> dict:
    """
    Validate a Groq API key by making a lightweight test request.

    Args:
        api_key: The Groq API key to validate

    Returns:
        {"valid": bool, "error": Optional[str]}
    """
    try:
        # Minimal request to check if key is valid
        await _call_groq_api("Say 'OK'", api_key, temperature=0, max_tokens=10)
        return {"valid": True, "error": None}
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            return {"valid": False, "error": "Invalid API key"}
        elif exc.response.status_code == 429:
            return {"valid": False, "error": "Rate limited - key may be valid but quota exceeded"}
        else:
            return {"valid": False, "error": f"HTTP {exc.response.status_code}"}
    except Exception as exc:
        return {"valid": False, "error": str(exc)}
