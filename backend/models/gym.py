from datetime import UTC, datetime
from typing import Any

from models.gym_queue import GymQueue
from models.gym_session import GymSession
from models.queue_entry import QueueEntry
from stores.session_store import InMemorySessionStore
from stores.store_factory import create_session_store
from stores.supabase_store import SupabaseStore


class Gym:
    def __init__(
        self,
        capacity: int = 20,
        operating_hours: str = "",
        session_store: InMemorySessionStore | SupabaseStore | None = None,
    ):
        self.capacity = capacity
        self.operating_hours = operating_hours
        self.session_store = (
            session_store if session_store is not None else create_session_store()
        )
        self.default_duration_min = 60
        self.manual_qr_deactivated = False
        self.queue = GymQueue(self.session_store)

    def get_operating_hours(self) -> str:
        return self.operating_hours

    def get_capacity(self) -> int:
        return self.capacity

    def get_occupancy(self) -> int:
        return self.session_store.count()

    def get_information(self) -> dict[str, Any]:
        occupancy = self.get_occupancy()
        return {
            "capacity": self.get_capacity(),
            "occupancy": occupancy,
            "operatingHours": self.get_operating_hours(),
            "isFull": occupancy >= self.get_capacity(),
        }

    def get_active_queue(self) -> list[dict[str, Any]]:
        return self.session_store.get_active()

    def get_waitlist_queue(self) -> list[dict[str, Any]]:
        return self.queue.get_queue()

    def get_session(self, user_id: str, removed_by: str = "self") -> GymSession | None:
        user = next(
            (entry for entry in self.get_active_queue() if entry["userId"] == user_id),
            None,
        )
        if user is None:
            return None
        return GymSession(
            user,
            lambda current_user_id: self._end_session(current_user_id, removed_by),
        )

    @staticmethod
    def _now() -> str:
        return datetime.now(UTC).isoformat()

    @staticmethod
    def _normalize_user_data(user_data: dict[str, Any]) -> tuple[str, str]:
        user_id = user_data["userId"].strip()
        full_name = user_data["fullName"].strip()
        if not user_id or not full_name:
            raise ValueError("A user ID and full name are required.")
        return user_id, full_name

    def _new_user_record(
        self, user_id: str, full_name: str, user_data: dict[str, Any]
    ) -> dict[str, Any]:
        return {
            "id": f"user-{user_id}",
            "userId": user_id,
            "fullName": full_name,
            "durationMinutes": user_data.get("durationMinutes")
            or self.default_duration_min,
            "notify5MinBefore": bool(user_data.get("notify5MinBefore", False)),
            "syncFailed": False,
        }

    def _find_queued_user(
        self, user_id: str
    ) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        active = next(
            (user for user in self.get_active_queue() if user["userId"] == user_id),
            None,
        )
        waiting = next(
            (user for user in self.get_waitlist_queue() if user["userId"] == user_id),
            None,
        )
        return active, waiting

    def add_to_active_queue(self, user_data: dict[str, Any]) -> dict[str, Any]:
        user_id, full_name = self._normalize_user_data(user_data)
        active, waiting = self._find_queued_user(user_id)
        if active or waiting:
            raise ValueError(f"User {user_id!r} is already in a queue.")
        if self.get_occupancy() >= self.capacity:
            raise ValueError("The active queue is at full capacity.")

        record = self._new_user_record(user_id, full_name, user_data)
        record["joinedAt"] = self._now()
        return self.session_store.add(user_id, record)

    def add_to_waitlist_queue(self, user_data: dict[str, Any]) -> dict[str, Any]:
        user_id, full_name = self._normalize_user_data(user_data)
        active, waiting = self._find_queued_user(user_id)
        if active or waiting:
            raise ValueError(f"User {user_id!r} is already in a queue.")

        record = self._new_user_record(user_id, full_name, user_data)
        record["addedAt"] = self._now()
        return self.queue.add_to_queue(user_id, record)

    def check_in(self, user_data: dict[str, Any]) -> dict[str, Any]:
        user_id, full_name = self._normalize_user_data(user_data)
        active, waiting = self._find_queued_user(user_id)
        if active:
            return {
                "success": True,
                "alreadyActive": True,
                "status": "active",
                "user": active,
            }
        if waiting:
            return {
                "success": True,
                "alreadyWaitlisted": True,
                "status": "waitlist",
                "user": waiting,
            }

        record = self._new_user_record(user_id, full_name, user_data)

        if self.get_occupancy() >= self.capacity:
            record["addedAt"] = self._now()
            waitlisted_user = self.queue.add_to_queue(user_id, record)
            waiting_users = self.get_waitlist_queue()
            position = next(
                i
                for i, user in enumerate(waiting_users, start=1)
                if user["userId"] == user_id
            )
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

    def _end_session(self, user_id: str, removed_by: str = "self") -> bool:
        removed = self.session_store.remove(user_id)
        if not removed:
            return False
        if removed_by == "staff":
            self.session_store.set_checkout_notice(
                user_id, "You have been removed from the queue."
            )
        return True

    def check_out(self, user_id: str, removed_by: str = "self") -> bool:
        session = self.get_session(user_id, removed_by)
        if session is None:
            return False
        return session.end_session()

    def promote_from_waitlist(self, user_id: str) -> dict[str, Any] | None:
        if self.get_occupancy() >= self.capacity:
            return None
        waiting = next(
            (user for user in self.get_waitlist_queue() if user["userId"] == user_id),
            None,
        )
        if waiting is None:
            return None
        queue_entry = QueueEntry(waiting, self.queue)
        if not queue_entry.update_state("admitted"):
            return None

        user = {key: value for key, value in waiting.items() if key != "addedAt"}
        user.update(
            {
                "id": f"user-{user_id}",
                "joinedAt": self._now(),
                "syncFailed": False,
            }
        )
        return self.session_store.add(user_id, user)

    def remove_from_waitlist(self, user_id: str) -> bool:
        waiting = next(
            (user for user in self.get_waitlist_queue() if user["userId"] == user_id),
            None,
        )
        if waiting is None:
            return False
        return QueueEntry(waiting, self.queue).update_state("removed")

    def update_waitlist_notification(
        self, user_id: str, notify: bool
    ) -> dict[str, Any] | None:
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
        self.session_store = create_session_store()
        self.queue = GymQueue(self.session_store)
        self.capacity = 20
        self.default_duration_min = 60
        self.manual_qr_deactivated = False
