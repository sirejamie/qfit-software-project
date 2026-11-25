from typing import Any

from stores.session_store import InMemorySessionStore
from stores.supabase_store import SupabaseStore


class GymQueue:
    def __init__(self, session_store: InMemorySessionStore | SupabaseStore):
        self.session_store = session_store

    def add_to_queue(self, user_id: str, user: dict[str, Any]) -> dict[str, Any]:
        return self.session_store.add_to_waitlist(user_id, user)

    def remove_from_queue(
        self, user_id: str, status: str = "removed"
    ) -> dict[str, Any] | None:
        return self.session_store.remove_from_waitlist(user_id, status=status)

    def get_queue(self) -> list[dict[str, Any]]:
        return sorted(
            self.session_store.get_waitlist(),
            key=lambda user: user.get("addedAt", ""),
        )

    def get_next_user(self) -> dict[str, Any] | None:
        queue = self.get_queue()
        return queue[0] if queue else None
