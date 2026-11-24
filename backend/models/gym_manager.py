from models.gym import Gym


class GymManager:
    FULL_MESSAGE = "The gym is at full capacity. Please try again shortly."
    def __init__(self, gym: Gym):
        self.gym = gym

    def is_gym_full(self) -> bool:
        return self.gym.get_occupancy() >= self.gym.capacity

    def get_capacity_status(self) -> dict:
        is_full = self.is_gym_full();
        return {
            "current_count": self.gym.get_occupancy(),
            "max_capacity": self.gym.capacity,
            "is_full": is_full,
            "qr_active": not is_full,
            "message": self.FULL_MESSAGE if is_full else None,
        }