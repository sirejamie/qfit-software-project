import os
from pathlib import Path

from dotenv import load_dotenv

from supabase import Client, create_client

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_KEY", "").strip()
    )
    if not url or not key:
        raise ValueError(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the Supabase "
            "service_role JWT. SUPABASE_KEY is supported as a legacy fallback."
        )
    return create_client(url, key)
