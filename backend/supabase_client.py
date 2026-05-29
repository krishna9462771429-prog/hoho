import os
from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required")

# Use service role key if available, otherwise fall back to anon key
api_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
supabase: Client = create_client(SUPABASE_URL, api_key)


def get_supabase() -> Client:
    return supabase
