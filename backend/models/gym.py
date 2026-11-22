class Gym:
    def __init__(self, capacity: int = 20, operating_hours: str = "", occupancy: int = 0):
        self.capacity_ = capacity
        self.operating_hours_ = operating_hours
        self.occupancy_ = occupancy

    def get_occupancy(self) -> int:
        return self.occupancy_;

    def display_operating_hours(self) -> str:
        return self.operating_hours_