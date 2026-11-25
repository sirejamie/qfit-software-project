class Gym:
    def __init__(
        self, capacity: int = 20, operating_hours: str = "", occupancy: int = 0
    ):
        self.capacity = capacity
        self.operating_hours = operating_hours
        self.occupancy = occupancy

    def get_operating_hours(self) -> str:
        return self.operating_hours

    def get_capacity(self) -> int:
        return self.capacity

    def get_occupancy(self) -> int:
        return len(self.get_active_queue())

    def is_gym_full(self) -> bool:
        return self.get_occupancy() >= self.capacity

    def get_capacity_status(self) -> dict:
        message = "The gym is at full capacity. Please try again shortly."
        is_full = self.is_gym_full();
        return { "qr_active": not is_full, "message": message if is_full else None, }

    def get_active_queue(self) -> list[dict[str, int]]:
        return [{"james": 2}]

    def get_waitlist_queue(self) -> list[dict[str, int]]:
        return [{"baker": 2}]
