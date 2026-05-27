import os
import httpx
import json
from typing import Optional, Dict, Any, List
from datetime import datetime

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"


FAILURE_CATEGORIES = {
    "timeout": "Request exceeded timeout limit",
    "dns": "DNS resolution failed",
    "rate_limit": "Rate limit exceeded (429)",
    "auth": "Authentication failed (401/403)",
    "server_error": "Server error (5xx)",
    "client_error": "Client error (4xx)",
    "ssl": "SSL/TLS certificate issue",
    "network": "Network connectivity issue",
    "unknown": "Unknown error",
}

SEVERITY_LEVELS = ["low", "medium", "high", "critical"]
RECOMMENDED_ACTIONS = ["retry", "skip", "escalate", "investigate", "disable", "contact_support"]


def categorize_failure(status_code: Optional[int], error_message: str) -> str:
    msg_lower = error_message.lower() if error_message else ""

    if "timeout" in msg_lower:
        return "timeout"
    if "dns" in msg_lower or "resolve" in msg_lower:
        return "dns"
    if "ssl" in msg_lower or "certificate" in msg_lower:
        return "ssl"
    if "rate" in msg_lower or "429" in msg_lower:
        return "rate_limit"
    if "auth" in msg_lower or "unauthorized" in msg_lower or "forbidden" in msg_lower:
        return "auth"
    if "connection" in msg_lower or "network" in msg_lower or "econnrefused" in msg_lower:
        return "network"

    if status_code:
        if status_code == 429:
            return "rate_limit"
        if status_code in (401, 403):
            return "auth"
        if 500 <= status_code < 600:
            return "server_error"
        if 400 <= status_code < 500:
            return "client_error"

    return "unknown"


async def _call_groq(prompt: str) -> Dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 600,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(GROQ_API_URL, json=payload, headers=headers)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return _parse_diagnosis_response(content, "groq")


async def _call_gemini(prompt: str) -> Dict[str, Any]:
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 600},
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload)
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        return _parse_diagnosis_response(text, "gemini")


def _parse_diagnosis_response(content: str, provider: str) -> Dict[str, Any]:
    content = content.strip()
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        lines = content.split("\n")
        result = {}
        for line in lines:
            if ":" in line:
                key, value = line.split(":", 1)
                key = key.strip().lower().replace(" ", "_").replace("-", "_")
                value = value.strip().strip('"').strip("'")
                result[key] = value

    result["provider_used"] = result.get("provider_used", provider)
    return result


async def diagnose_failure(
    api_name: str,
    url: str,
    status_code: Optional[int],
    error_message: str,
    latency_ms: int,
    previous_logs: List[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    category = categorize_failure(status_code, error_message)

    prev_context = ""
    if previous_logs and len(previous_logs) > 0:
        recent = previous_logs[-5:]
        prev_context = "\nRecent failure history:\n" + "\n".join([
            f"- {log.get('checked_at', 'unknown')}: {log.get('error_message', 'unknown')} ({log.get('latency_ms', 0)}ms)"
            for log in recent
        ])

    prompt = f"""You are an expert API failure diagnosis AI. Analyze this API failure and provide a structured diagnosis.

API Name: {api_name}
URL: {url}
Status Code: {status_code or 'N/A'}
Error Message: {error_message}
Latency: {latency_ms}ms
Failure Category: {category}
{prev_context}

Provide a JSON response with these exact fields:
{{
  "diagnosis": "Brief explanation of the likely root cause",
  "severity": "low|medium|high|critical",
  "confidence": 0.0-1.0,
  "suggested_fix": "Actionable step to resolve the issue",
  "recommended_action": "retry|skip|escalate|investigate|disable|contact_support",
  "explanation": "Detailed explanation for developers"
}}

Respond ONLY with valid JSON. No markdown. No extra text."""

    try:
        result = await _call_groq(prompt)
    except Exception:
        try:
            result = await _call_gemini(prompt)
        except Exception as e:
            result = {
                "diagnosis": f"Unable to diagnose: {error_message}",
                "severity": "medium",
                "confidence": 0.5,
                "suggested_fix": "Check API manually or review logs",
                "recommended_action": "investigate",
                "explanation": str(e),
                "provider_used": "fallback",
            }

    result["failure_category"] = category
    if "severity" not in result:
        result["severity"] = "medium"
    if "confidence" not in result:
        result["confidence"] = 0.7
    if "suggested_fix" not in result:
        result["suggested_fix"] = "Review API configuration and logs"
    if "recommended_action" not in result:
        result["recommended_action"] = "investigate"
    if "diagnosis" not in result:
        result["diagnosis"] = error_message

    result["severity"] = result["severity"].lower() if isinstance(result["severity"], str) else "medium"
    result["confidence"] = float(result.get("confidence", 0.7))
    result["confidence"] = max(0.0, min(1.0, result["confidence"]))

    return result
