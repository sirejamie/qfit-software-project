from models.session_store import InMemorySessionStore


class Gym:
    def __init__(self, capacity: int = 20, operating_hours: str = "", session_store = None):
        self.capacity = capacity
        self.operating_hours = operating_hours
        self.session_store = session_store or InMemorySessionStore()

    def get_occupancy(self) -> int:
        return self.session_store.count()

    def display_operating_hours(self) -> str:
        return self.operating_hours