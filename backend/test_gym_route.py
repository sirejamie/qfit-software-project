import pytest
from fastapi.testclient import TestClient

from main import app
from models.gym_manager import GymManager
from models.session_store import InMemorySessionStore
from routes.gym import gym_manager

client = TestClient(app)

@pytest.fixture(autouse=True)
def fresh_store():
    gym_manager.gym.session_store = InMemorySessionStore()

def fill(n: int) -> None:
    for i in range(n):
        gym_manager.gym.session_store.add(f"student-{i}")

# TS-4, TS-6
def test_route_active_below_capacity():
    fill(12)
    response = client.get("/gym/status")
    body = response.json()
    assert response.status_code == 200
    assert body["current_count"] == 12
    assert body["qr_active"] is True
    assert body["message"] is None

# TS-3, TS-5
def test_route_inactive_with_message_when_full():
    fill(20)
    body = client.get("/gym/status").json()
    assert body["qr_active"] is False
    assert body["message"] == GymManager.FULL_MESSAGE

# TS-2
def test_route_reactivates_after_user_leaves():
    fill(20)
    gym_manager.gym.session_store.remove("student-0")
    body = client.get("/gym/status").json()
    assert body["current_count"] == 19
    assert body["qr_active"] is True