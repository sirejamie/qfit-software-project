from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any


class GymSession:
    def __init__(
        self,
        user: dict[str, Any],
        end_session: Callable[[str], bool],
    ):
        self.user = dict(user)
        self._end_session_callback = end_session
        self._ended = False

    def get_remaining_time(self) -> timedelta:
        if self._ended:
            return timedelta(0)

        joined_at = datetime.fromisoformat(self.user["joinedAt"])
        if joined_at.tzinfo is None:
            joined_at = joined_at.replace(tzinfo=UTC)
        expires_at = joined_at + timedelta(minutes=self.user["durationMinutes"])
        return max(timedelta(0), expires_at - datetime.now(UTC))

    def end_session(self) -> bool:
        if self._ended:
            return False

        self._ended = self._end_session_callback(self.user["userId"])
        return self._ended
