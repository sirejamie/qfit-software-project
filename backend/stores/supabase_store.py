from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from lib.supabase_client import get_supabase_client
from supabase import Client


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value)


class SupabaseStore:
    """Persist gym sessions, queue entries, and checkout notices in Supabase."""

    NOTICE_TITLE = "Gym checkout"

    def __init__(self, client: Client | None = None):
        self.client = client if client is not None else get_supabase_client()

    def _find_user(self, user_id: str) -> dict[str, Any] | None:
        users = (
            self.client.table("users")
            .select("id,user_identifier,full_name")
            .eq("user_identifier", user_id)
            .limit(1)
            .execute()
            .data
        )
        if not users:
            try:
                UUID(user_id)
            except ValueError:
                pass
            else:
                users = (
                    self.client.table("users")
                    .select("id,user_identifier,full_name")
                    .eq("id", user_id)
                    .limit(1)
                    .execute()
                    .data
                )
        if not users:
            return None
        return users[0]

    def _require_user(self, user_id: str) -> dict[str, Any]:
        user = self._find_user(user_id)
        if user is None:
            raise ValueError(f"No Supabase user matches user ID {user_id!r}.")
        return user

    @staticmethod
    def _user_id(user: dict[str, Any]) -> str:
        return user.get("user_identifier") or user["id"]

    def _session_record(
        self, session: dict[str, Any], user: dict[str, Any]
    ) -> dict[str, Any]:
        started = _parse_datetime(session["start_time"])
        expires = session.get("expires_at")
        duration = (
            round((_parse_datetime(expires) - started).total_seconds() / 60)
            if expires
            else 60
        )
        return {
            "id": session["id"],
            "userId": self._user_id(user),
            "fullName": user["full_name"],
            "joinedAt": session["start_time"],
            "durationMinutes": duration,
            "syncFailed": session["timer_sync_status"] == "unsynced",
        }

    def _queue_record(
        self, entry: dict[str, Any], user: dict[str, Any]
    ) -> dict[str, Any]:
        return {
            "id": entry["id"],
            "userId": self._user_id(user),
            "fullName": user["full_name"],
            "addedAt": entry["joined_at"],
        }

    def _users_by_ids(self, user_ids: list[str]) -> dict[str, dict[str, Any]]:
        if not user_ids:
            return {}
        users = (
            self.client.table("users")
            .select("id,user_identifier,full_name")
            .in_("id", user_ids)
            .execute()
            .data
        )
        return {user["id"]: user for user in users}

    def add(self, user_id: str, user: dict[str, Any] | None = None) -> dict[str, Any]:
        profile = self._require_user(user_id)
        record = user or {}
        start_time = record.get("joinedAt", _now())
        duration = record.get("durationMinutes", 60)
        expires_at = _parse_datetime(start_time) + timedelta(minutes=duration)
        result = (
            self.client.table("gym_sessions")
            .insert(
                {
                    "user_id": profile["id"],
                    "start_time": start_time,
                    "expires_at": expires_at.isoformat(),
                    "status": "active",
                    "timer_sync_status": (
                        "unsynced" if record.get("syncFailed", False) else "synced"
                    ),
                }
            )
            .select("*")
            .execute()
        )
        if not result.data:
            raise RuntimeError("Supabase did not return the inserted gym session.")
        return self._session_record(result.data[0], profile)

    def remove(self, user_id: str) -> dict[str, Any] | None:
        profile = self._find_user(user_id)
        if profile is None:
            return None
        result = (
            self.client.table("gym_sessions")
            .update({"status": "completed", "end_time": _now()})
            .eq("user_id", profile["id"])
            .eq("status", "active")
            .select("*")
            .execute()
        )
        if not result.data:
            return None
        return self._session_record(result.data[0], profile)

    def count(self) -> int:
        result = (
            self.client.table("gym_sessions")
            .select("id", count="exact")
            .eq("status", "active")
            .execute()
        )
        return result.count if result.count is not None else len(result.data or [])

    def get_active(self) -> list[dict[str, Any]]:
        sessions = (
            self.client.table("gym_sessions")
            .select("*")
            .eq("status", "active")
            .order("start_time")
            .execute()
            .data
        )
        profiles = self._users_by_ids([session["user_id"] for session in sessions])
        if any(session["user_id"] not in profiles for session in sessions):
            raise RuntimeError(
                "A gym session references a user that could not be loaded."
            )
        return [
            self._session_record(session, profiles[session["user_id"]])
            for session in sessions
        ]

    def update_active(
        self, user_id: str, changes: dict[str, Any]
    ) -> dict[str, Any] | None:
        unsupported = changes.keys() - {"syncFailed"}
        if unsupported:
            raise ValueError(
                f"Unsupported gym session fields: {', '.join(unsupported)}"
            )
        profile = self._find_user(user_id)
        if profile is None:
            return None
        updates = {}
        if "syncFailed" in changes:
            updates["timer_sync_status"] = (
                "unsynced" if changes["syncFailed"] else "synced"
            )
        result = (
            self.client.table("gym_sessions")
            .update(updates)
            .eq("user_id", profile["id"])
            .eq("status", "active")
            .select("*")
            .execute()
        )
        return self._session_record(result.data[0], profile) if result.data else None

    def add_to_waitlist(self, user_id: str, user: dict[str, Any]) -> dict[str, Any]:
        profile = self._require_user(user_id)
        result = (
            self.client.table("gym_queue")
            .insert(
                {
                    "user_id": profile["id"],
                    "joined_at": user.get("addedAt", _now()),
                    "status": "waiting",
                }
            )
            .select("*")
            .execute()
        )
        if not result.data:
            raise RuntimeError("Supabase did not return the inserted queue entry.")
        return self._queue_record(result.data[0], profile)

    def remove_from_waitlist(
        self, user_id: str, status: str = "removed"
    ) -> dict[str, Any] | None:
        if status not in {"removed", "admitted"}:
            raise ValueError("Waitlist status must be 'removed' or 'admitted'.")
        profile = self._find_user(user_id)
        if profile is None:
            return None
        result = (
            self.client.table("gym_queue")
            .update({"status": status})
            .eq("user_id", profile["id"])
            .eq("status", "waiting")
            .select("*")
            .execute()
        )
        return self._queue_record(result.data[0], profile) if result.data else None

    def get_waitlist(self) -> list[dict[str, Any]]:
        entries = (
            self.client.table("gym_queue")
            .select("*")
            .eq("status", "waiting")
            .order("joined_at")
            .execute()
            .data
        )
        profiles = self._users_by_ids([entry["user_id"] for entry in entries])
        if any(entry["user_id"] not in profiles for entry in entries):
            raise RuntimeError(
                "A gym queue entry references a user that could not be loaded."
            )
        return [
            self._queue_record(entry, profiles[entry["user_id"]]) for entry in entries
        ]

    def update_waitlist(
        self, user_id: str, changes: dict[str, Any]
    ) -> dict[str, Any] | None:
        if changes:
            raise NotImplementedError(
                "The gym_queue schema has no columns for waitlist preferences."
            )
        return None

    def set_checkout_notice(self, user_id: str, message: str) -> None:
        profile = self._require_user(user_id)
        self.client.table("notifications").insert(
            {
                "user_id": profile["id"],
                "title": self.NOTICE_TITLE,
                "message": message,
                "type": "system",
            }
        ).execute()

    def _checkout_notice(self, user_id: str) -> dict[str, Any] | None:
        profile = self._find_user(user_id)
        if profile is None:
            return None
        notices = (
            self.client.table("notifications")
            .select("id,message,created_at")
            .eq("user_id", profile["id"])
            .eq("title", self.NOTICE_TITLE)
            .eq("type", "system")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        return notices[0] if notices else None

    def get_checkout_notice(self, user_id: str) -> dict[str, Any] | None:
        notice = self._checkout_notice(user_id)
        return (
            {"message": notice["message"], "at": notice["created_at"]}
            if notice
            else None
        )

    def consume_checkout_notice(self, user_id: str) -> dict[str, Any] | None:
        notice = self._checkout_notice(user_id)
        if not notice:
            return None
        self.client.table("notifications").delete().eq("id", notice["id"]).execute()
        return {"message": notice["message"], "at": notice["created_at"]}
