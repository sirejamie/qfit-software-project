from typing import Any, ClassVar

from models.gym_queue import GymQueue


class QueueEntry:
    STATES: ClassVar[set[str]] = {"waiting", "admitted", "removed"}

    def __init__(self, user: dict[str, Any], gym_queue: GymQueue):
        self.user = dict(user)
        self.gym_queue = gym_queue
        self.status = user.get("status", "waiting")

    def update_state(self, status: str) -> bool:
        if status not in self.STATES:
            raise ValueError(f"Unsupported queue state: {status!r}.")
        if status == self.status:
            return True
        if self.status != "waiting" or status == "waiting":
            return False

        updated = self.gym_queue.remove_from_queue(self.user["userId"], status)
        if updated is None:
            return False
        self.status = status
        return True
