class InMemorySessionStore:
    def __init__(self):
        self.active: set[str] = set()

    def add(self, student_id: str) -> None:
        self.active.add(student_id)

    def remove(self, student_id: str) -> None:
        self.active.discard(student_id)

    def count(self) -> int:
        return len(self.active)
