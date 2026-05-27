import os
import httpx
import json
from typing import Optional

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"


async def generate_fallback(failure_reason: str, api_context: str = "") -> dict:
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

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 500,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(GROQ_API_URL, json=payload, headers=headers)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return json.loads(content)


async def generate_workflow(description: str) -> str:
    prompt = f"""You are an API workflow architect AI.
The user wants: {description}

Generate a detailed JSON API workflow plan including:
- Step-by-step API sequence
- Request/response schemas
- Error handling
- Merge strategy
- Integration example

Respond with clean, well-structured JSON."""

    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.4,
        "max_tokens": 1000,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(GROQ_API_URL, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
