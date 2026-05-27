import os
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

security = HTTPBearer()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

# Singleton client for auth verification
_auth_client: Client | None = None


def get_auth_client() -> Client:
    """Get or create the singleton auth client."""
    global _auth_client
    if _auth_client is None:
        _auth_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _auth_client


async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """Verify JWT and return user info."""
    token = credentials.credentials
    try:
        client = get_auth_client()
        response = client.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": response.user.id, "email": response.user.email}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")
