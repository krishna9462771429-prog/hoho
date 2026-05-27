import os
import httpx
import json

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"


async def generate_fallback(failure_reason: str, api_context: str = "") -> dict:
    prompt = f"""An API failed: {failure_reason}. Context: {api_context}.
Generate a structured JSON fallback response with status, message, data, explanation, and retry_after fields.
Respond ONLY with valid JSON."""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 500},
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json=payload,
        )
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        # Strip markdown code blocks if present
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        result = json.loads(text)
        result["provider"] = "gemini"
        return result


async def generate_format(description: str) -> str:
    prompt = f"""Generate a JSON integration format and schema for: {description}
Include request structure, response schema, and example code. Respond with clean JSON."""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 1000},
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload)
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
