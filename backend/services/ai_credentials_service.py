"""
AI Credentials Service - Centralized BYOK key resolution.

This service resolves which API keys to use for AI operations:
1. If user has personal keys enabled and keys exist → use personal keys
2. Otherwise → fallback to platform-level keys

Security considerations:
- Never log raw API keys
- Never expose full keys in API responses
- Mask keys before returning to frontend (gsk_****abcd)
"""

import logging
import os
import re
from dataclasses import dataclass
from typing import Optional, Dict, Any

from supabase_client import get_supabase

logger = logging.getLogger(__name__)

# Platform-level keys from environment
PLATFORM_GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
PLATFORM_GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")


@dataclass
class AICredentials:
    """Resolved AI credentials for a user."""
    groq_key: Optional[str]
    gemini_key: Optional[str]
    groq_source: str  # "user" or "platform"
    gemini_source: str  # "user" or "platform"


def mask_api_key(key: Optional[str]) -> Optional[str]:
    """
    Mask an API key for safe display.

    Examples:
        gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxabcd → gsk_****abcd
        AIzasxxxxxxxxxxxxxxxxxxxxxxxxxxxefgh → AIza****efgh
        None → None
    """
    if not key:
        return None

    # Show first 3-4 chars and last 4 chars
    if len(key) < 12:
        return "****"

    # Find common prefixes
    prefixes = ["gsk_", "sk-", "AIza", "api-"]
    for prefix in prefixes:
        if key.startswith(prefix):
            prefix_len = len(prefix)
            return f"{key[:prefix_len]}****{key[-4:]}"

    # Default: show first 4 and last 4
    return f"{key[:4]}****{key[-4:]}"


def get_user_settings(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch user settings from database.
    Returns None if not found.
    """
    try:
        sb = get_supabase()
        result = sb.table("user_settings").select("*").eq("user_id", user_id).maybeSingle().execute()
        return result.data
    except Exception as exc:
        logger.error(f"Failed to fetch user settings for {user_id}: {exc}")
        return None


def get_ai_credentials(user_id: Optional[str] = None) -> AICredentials:
    """
    Resolve AI credentials for a user.

    Resolution priority:
    1. If user_id provided and user has personal keys enabled:
       - Use user's Groq key if exists, else platform Groq key
       - Use user's Gemini key if exists, else platform Gemini key
    2. Otherwise, use platform keys exclusively

    Args:
        user_id: Optional user ID for BYOK lookup

    Returns:
        AICredentials dataclass with resolved keys and sources
    """
    # Default: platform keys
    groq_key = PLATFORM_GROQ_API_KEY or None
    gemini_key = PLATFORM_GEMINI_API_KEY or None
    groq_source = "platform"
    gemini_source = "platform"

    if not user_id:
        return AICredentials(
            groq_key=groq_key,
            gemini_key=gemini_key,
            groq_source=groq_source,
            gemini_source=gemini_source,
        )

    # Try to get user settings
    settings = get_user_settings(user_id)
    if not settings:
        logger.debug(f"No user settings found for {user_id}, using platform keys")
        return AICredentials(
            groq_key=groq_key,
            gemini_key=gemini_key,
            groq_source=groq_source,
            gemini_source=gemini_source,
        )

    # Check if BYOK is enabled
    use_personal = settings.get("use_personal_ai_keys", False)
    if not use_personal:
        logger.debug(f"BYOK disabled for {user_id}, using platform keys")
        return AICredentials(
            groq_key=groq_key,
            gemini_key=gemini_key,
            groq_source=groq_source,
            gemini_source=gemini_source,
        )

    # BYOK enabled - use personal keys if available
    user_groq = settings.get("groq_api_key")
    user_gemini = settings.get("gemini_api_key")

    if user_groq:
        groq_key = user_groq
        groq_source = "user"
        logger.debug(f"Using personal Groq key for {user_id}")
    else:
        groq_key = PLATFORM_GROQ_API_KEY or None
        groq_source = "platform"
        logger.debug(f"No personal Groq key for {user_id}, using platform")

    if user_gemini:
        gemini_key = user_gemini
        gemini_source = "user"
        logger.debug(f"Using personal Gemini key for {user_id}")
    else:
        gemini_key = PLATFORM_GEMINI_API_KEY or None
        gemini_source = "platform"
        logger.debug(f"No personal Gemini key for {user_id}, using platform")

    return AICredentials(
        groq_key=groq_key,
        gemini_key=gemini_key,
        groq_source=groq_source,
        gemini_source=gemini_source,
    )


def get_ai_credentials_masked(user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Get AI credentials with keys masked for safe frontend display.

    Returns:
        {
            "groq_key_masked": "gsk_****abcd" or null,
            "gemini_key_masked": "AIza****efgh" or null,
            "groq_source": "user" | "platform",
            "gemini_source": "user" | "platform",
            "use_personal_ai_keys": bool,
            "has_groq_key": bool,
            "has_gemini_key": bool,
        }
    """
    if not user_id:
        return {
            "groq_key_masked": mask_api_key(PLATFORM_GROQ_API_KEY) if PLATFORM_GROQ_API_KEY else None,
            "gemini_key_masked": mask_api_key(PLATFORM_GEMINI_API_KEY) if PLATFORM_GEMINI_API_KEY else None,
            "groq_source": "platform",
            "gemini_source": "platform",
            "use_personal_ai_keys": False,
            "has_groq_key": bool(PLATFORM_GROQ_API_KEY),
            "has_gemini_key": bool(PLATFORM_GEMINI_API_KEY),
        }

    settings = get_user_settings(user_id)
    use_personal = settings.get("use_personal_ai_keys", False) if settings else False

    user_groq = settings.get("groq_api_key") if settings else None
    user_gemini = settings.get("gemini_api_key") if settings else None

    if use_personal:
        groq_display = user_groq or PLATFORM_GROQ_API_KEY
        gemini_display = user_gemini or PLATFORM_GEMINI_API_KEY
        groq_source = "user" if user_groq else "platform"
        gemini_source = "user" if user_gemini else "platform"
    else:
        groq_display = PLATFORM_GROQ_API_KEY
        gemini_display = PLATFORM_GEMINI_API_KEY
        groq_source = "platform"
        gemini_source = "platform"

    return {
        "groq_key_masked": mask_api_key(groq_display) if groq_display else None,
        "gemini_key_masked": mask_api_key(gemini_display) if gemini_display else None,
        "groq_source": groq_source,
        "gemini_source": gemini_source,
        "use_personal_ai_keys": use_personal,
        "has_groq_key": bool(user_groq) if use_personal else bool(PLATFORM_GROQ_API_KEY),
        "has_gemini_key": bool(user_gemini) if use_personal else bool(PLATFORM_GEMINI_API_KEY),
    }
