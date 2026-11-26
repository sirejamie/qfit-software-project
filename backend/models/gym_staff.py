from typing import Any

from models.gym import Gym


class GymStaff:
    def __init__(self, gym: Gym):
        self.gym = gym

    def view_gym_list(self) -> list[dict[str, Any]]:
        return self.gym.get_active_queue()

    def remove_user(self, user_id: str) -> bool:
        return self.gym.check_out(user_id, removed_by="staff")
