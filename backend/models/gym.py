from datetime import UTC, datetime
from typing import Any

from models.session_store import InMemorySessionStore


class Gym:
    def __init__(
        self,
        capacity: int = 20,
        operating_hours: str = "",
        session_store: InMemorySessionStore | None = None,
    ):
        self.capacity = capacity
        self.operating_hours = operating_hours
        self.session_store = session_store or InMemorySessionStore()
        self.default_duration_min = 60
        self.manual_qr_deactivated = False

    def get_operating_hours(self) -> str:
        return self.operating_hours

    def get_capacity(self) -> int:
        return self.capacity

    def get_occupancy(self) -> int:
        return self.session_store.count()

    def get_active_queue(self) -> list[dict[str, Any]]:
        return self.session_store.get_active()

    def get_waitlist_queue(self) -> list[dict[str, Any]]:
        return sorted(self.session_store.get_waitlist(), key=lambda user: user["addedAt"])

    @staticmethod
    def _now() -> str:
        return datetime.now(UTC).isoformat()

    def check_in(self, user_data: dict[str, Any]) -> dict[str, Any]:
        user_id = user_data["userId"].strip()
        full_name = user_data["fullName"].strip()
        if not user_id or not full_name:
            raise ValueError("A user ID and full name are required.")

        active = next((user for user in self.get_active_queue() if user["userId"] == user_id), None)
        if active:
            return {"success": True, "alreadyActive": True, "status": "active", "user": active}

        waiting = next((user for user in self.get_waitlist_queue() if user["userId"] == user_id), None)
        if waiting:
            return {"success": True, "alreadyWaitlisted": True, "status": "waitlist", "user": waiting}

        record = {
            "id": f"user-{user_id}",
            "userId": user_id,
            "fullName": full_name,
            "durationMinutes": user_data.get("durationMinutes") or self.default_duration_min,
            "notify5MinBefore": bool(user_data.get("notify5MinBefore", False)),
            "syncFailed": False,
        }

        if self.get_occupancy() >= self.capacity:
            record["addedAt"] = self._now()
            waitlisted_user = self.session_store.add_to_waitlist(user_id, record)
            waiting_users = self.get_waitlist_queue()
            position = next(i for i, user in enumerate(waiting_users, start=1) if user["userId"] == user_id)
            return {
                "success": True,
                "status": "waitlist",
                "user": waitlisted_user,
                "position": position,
                "peopleAhead": position - 1,
            }

        record["joinedAt"] = self._now()
        active_user = self.session_store.add(user_id, record)
        return {"success": True, "status": "active", "user": active_user}

    def check_out(self, user_id: str, removed_by: str = "self") -> bool:
        removed = self.session_store.remove(user_id)
        if not removed:
            return False
        if removed_by == "staff":
            self.session_store.set_checkout_notice(user_id, "You have been removed from the queue.")
        return True

    def promote_from_waitlist(self, user_id: str) -> dict[str, Any] | None:
        if self.get_occupancy() >= self.capacity:
            return None
        waiting = self.session_store.remove_from_waitlist(user_id)
        if not waiting:
            return None

        user = {
            key: value
            for key, value in waiting.items()
            if key != "addedAt"
        }
        user.update({
            "id": f"user-{user_id}",
            "joinedAt": self._now(),
            "syncFailed": False,
        })
        return self.session_store.add(user_id, user)

    def remove_from_waitlist(self, user_id: str) -> bool:
        return self.session_store.remove_from_waitlist(user_id) is not None

    def update_waitlist_notification(self, user_id: str, notify: bool) -> dict[str, Any] | None:
        return self.session_store.update_waitlist(user_id, {"notify5MinBefore": notify})

    def resync_user(self, user_id: str) -> dict[str, Any] | None:
        return self.session_store.update_active(user_id, {"syncFailed": False})

    def get_settings(self) -> dict[str, Any]:
        return {
            "maxCapacity": self.capacity,
            "defaultDurationMin": self.default_duration_min,
            "manualQrDeactivated": self.manual_qr_deactivated,
        }

    def update_settings(self, partial: dict[str, Any]) -> dict[str, Any]:
        if "maxCapacity" in partial:
            self.capacity = partial["maxCapacity"]
        if "defaultDurationMin" in partial:
            self.default_duration_min = partial["defaultDurationMin"]
        if "manualQrDeactivated" in partial:
            self.manual_qr_deactivated = partial["manualQrDeactivated"]
        return self.get_settings()

    def reset(self) -> None:
        self.session_store = InMemorySessionStore()
        self.capacity = 20
        self.default_duration_min = 60
        self.manual_qr_deactivated = False
