from models.gym import Gym

class GymManager:
    MESSAGE = "The gym is at full capacity. Please try again shortly."

    def __init__(self, gym: Gym):
        self.gym = gym

    def is_gym_full(self) -> bool:
        return self.gym.get_occupancy() >= self.gym.capacity

    def get_capacity_status(self) -> dict:
        is_full = self.is_gym_full();
        return { "qr_active": not is_full, "message": self.MESSAGE if is_full else None, }
