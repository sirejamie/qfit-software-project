from models.gym import Gym


class GymManager:
    FULL_MESSAGE = "The gym is at full capacity. Please try again shortly."

    def __init__(self, gym: Gym):
        self.gym = gym
        self.gym_list = gym.get_active_queue()

    def is_gym_full(self) -> bool:
        return self.gym.get_occupancy() >= self.gym.get_capacity()

    def process_check_in(self, user_data: dict) -> dict:
        result = self.gym.check_in(user_data)
        self.update_gym_list()
        if result["status"] == "waitlist":
            result["message"] = self.FULL_MESSAGE
        return result

    def add_to_active_queue(self, user_data: dict) -> dict:
        user = self.gym.add_to_active_queue(user_data)
        self.update_gym_list()
        return user

    def add_to_waitlist_queue(self, user_data: dict) -> dict:
        return self.gym.add_to_waitlist_queue(user_data)

    def update_gym_list(self) -> list[dict]:
        self.gym_list = self.gym.get_active_queue()
        return self.gym_list

    def check_out(self, user_id: str, removed_by: str = "self") -> bool:
        removed = self.gym.check_out(user_id, removed_by)
        if removed:
            self.update_gym_list()
        return removed

    def promote_from_waitlist(self, user_id: str) -> dict | None:
        user = self.gym.promote_from_waitlist(user_id)
        if user is not None:
            self.update_gym_list()
        return user

    def get_capacity_status(self) -> dict:
        is_full = self.is_gym_full()
        self.update_gym_list()
        settings = self.gym.get_settings()
        return {
            "current_count": self.gym.get_occupancy(),
            "max_capacity": self.gym.get_capacity(),
            "is_full": is_full,
            "qr_active": not is_full and not self.gym.manual_qr_deactivated,
            "settings": settings,
            "message": self.FULL_MESSAGE if is_full else None,
        }
