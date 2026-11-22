from models.gym import Gym

class GymManager:
    def __init__(self, gym: Gym):
        self.gym = gym

    def is_gym_full(self) -> bool:
        return self.gym.get_occupancy() >= self.gym.capacity