class Gym:
    def __init__(self, capacity: int = 20, operating_hours: str = "", occupancy: int = 0):
        self.capacity = capacity
        self.operating_hours = operating_hours
        self.occupancy = occupancy

    def get_occupancy(self) -> int:
        return self.occupancy;

    def display_operating_hours(self) -> str:
        return self.operating_hours