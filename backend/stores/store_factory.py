import os

from stores.session_store import InMemorySessionStore
from stores.supabase_store import SupabaseStore


def create_session_store() -> InMemorySessionStore | SupabaseStore:
    backend = os.getenv("STORE_BACKEND", "memory").strip().lower()
    if backend == "memory":
        return InMemorySessionStore()
    if backend == "supabase":
        return SupabaseStore()
    raise ValueError("STORE_BACKEND must be either 'memory' or 'supabase'.")
