from datetime import UTC, datetime
from typing import Any


def _now() -> str:
    return datetime.now(UTC).isoformat()


class InMemorySessionStore:
    """In-memory mock database for active users, waitlist entries, and notices."""

    def __init__(self):
        self.active: dict[str, dict[str, Any]] = {}
        self.waitlist: dict[str, dict[str, Any]] = {}
        self.checkout_notices: dict[str, dict[str, Any]] = {}

    def add(self, user_id: str, user: dict[str, Any] | None = None) -> dict[str, Any]:
        record = user or {
            "id": user_id,
            "userId": user_id,
            "fullName": user_id,
            "joinedAt": _now(),
            "durationMinutes": 60,
            "syncFailed": False,
        }
        record = {**record, "id": record.get("id", user_id), "userId": user_id}
        self.active[user_id] = record
        return dict(record)

    def remove(self, user_id: str) -> dict[str, Any] | None:
        return self.active.pop(user_id, None)

    def count(self) -> int:
        return len(self.active)

    def get_active(self) -> list[dict[str, Any]]:
        return [dict(user) for user in self.active.values()]

    def update_active(self, user_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        user = self.active.get(user_id)
        if user is None:
            return None
        user.update(changes)
        return dict(user)

    def add_to_waitlist(self, user_id: str, user: dict[str, Any]) -> dict[str, Any]:
        record = {**user, "id": user.get("id", f"wait-{user_id}"), "userId": user_id}
        self.waitlist[user_id] = record
        return dict(record)

    def remove_from_waitlist(
        self, user_id: str, status: str = "removed"
    ) -> dict[str, Any] | None:
        return self.waitlist.pop(user_id, None)

    def get_waitlist(self) -> list[dict[str, Any]]:
        return [dict(user) for user in self.waitlist.values()]

    def update_waitlist(self, user_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        user = self.waitlist.get(user_id)
        if user is None:
            return None
        user.update(changes)
        return dict(user)

    def set_checkout_notice(self, user_id: str, message: str) -> None:
        self.checkout_notices[user_id] = {"message": message, "at": _now()}

    def get_checkout_notice(self, user_id: str) -> dict[str, Any] | None:
        notice = self.checkout_notices.get(user_id)
        return dict(notice) if notice else None

    def consume_checkout_notice(self, user_id: str) -> dict[str, Any] | None:
        return self.checkout_notices.pop(user_id, None)
