import pytest
from fastapi.testclient import TestClient

from main import app
from models.gym_manager import GymManager
from routes.gym import gym_manager

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_store():
    gym_manager.gym.reset()


def fill(n: int) -> None:
    for i in range(n):
        gym_manager.gym.session_store.add(f"user-{i}")


# TS-4, TS-6
def test_route_active_below_capacity():
    fill(12)
    response = client.get("/gym/status")
    body = response.json()
    assert response.status_code == 200
    assert body["current_count"] == 12
    assert body["qr_active"] is True
    assert body["message"] is None


def test_route_gym_information():
    response = client.get("/gym/information")

    assert response.status_code == 200
    assert response.json() == {
        "capacity": 20,
        "occupancy": 0,
        "operatingHours": "",
        "isFull": False,
    }


# TS-3, TS-5
def test_route_inactive_with_message_when_full():
    fill(20)
    body = client.get("/gym/status").json()
    assert body["qr_active"] is False
    assert body["message"] == GymManager.FULL_MESSAGE


# TS-2
def test_route_reactivates_after_user_leaves():
    fill(20)
    gym_manager.gym.session_store.remove("user-0")
    body = client.get("/gym/status").json()
    assert body["current_count"] == 19
    assert body["qr_active"] is True


def test_queue_endpoints_return_empty_lists_instead_of_placeholders():
    assert client.get("/gym/active").json() == []
    assert client.get("/gym/waitlist").json() == []


def test_checkin_persists_a_valid_active_user_record():
    response = client.post(
        "/gym/checkin",
        json={
            "userId": "user-123",
            "fullName": "Sample User",
            "durationMinutes": 45,
            "notify5MinBefore": True,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["status"] == "active"
    assert body["user"]["userId"] == "user-123"
    assert body["user"]["fullName"] == "Sample User"
    assert body["user"]["joinedAt"]
    assert body["user"]["durationMinutes"] == 45
    assert client.get("/gym/active").json() == [body["user"]]
    assert client.get("/gym/status").json()["current_count"] == 1


def test_full_capacity_checkin_is_persisted_to_waitlist():
    fill(20)

    response = client.post(
        "/gym/checkin",
        json={"userId": "waiting-user", "fullName": "Waiting User"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "waitlist"
    assert body["user"]["userId"] == "waiting-user"
    assert body["user"]["addedAt"]
    assert len(client.get("/gym/waitlist").json()) == 1


def test_staff_can_add_users_to_specific_queues():
    gym_manager.gym.capacity = 1
    active = client.post(
        "/gym/active",
        json={"userId": "active-user", "fullName": "Active User"},
    )
    waiting = client.post(
        "/gym/waitlist",
        json={"userId": "waiting-user", "fullName": "Waiting User"},
    )

    assert active.status_code == 201
    assert active.json()["user"]["userId"] == "active-user"
    assert waiting.status_code == 201
    assert waiting.json()["user"]["userId"] == "waiting-user"
    assert [user["userId"] for user in client.get("/gym/active").json()] == [
        "active-user"
    ]
    assert [user["userId"] for user in client.get("/gym/waitlist").json()] == [
        "waiting-user"
    ]


def test_manual_active_add_rejects_full_capacity_without_waitlisting():
    gym_manager.gym.capacity = 1
    fill(1)

    response = client.post(
        "/gym/active",
        json={"userId": "extra-user", "fullName": "Extra User"},
    )

    assert response.status_code == 409
    assert client.get("/gym/waitlist").json() == []


def test_checkout_and_waitlist_promotion_update_mock_database():
    fill(20)
    checkin = client.post(
        "/gym/checkin",
        json={"userId": "waiting-user", "fullName": "Waiting User"},
    ).json()
    assert checkin["status"] == "waitlist"

    checkout = client.post(
        "/gym/checkout/user-0",
        json={"removedBy": "staff"},
    )
    assert checkout.status_code == 204
    assert client.get("/gym/notices/user-0").json()["message"] == (
        "You have been removed from the queue."
    )

    promoted = client.post("/gym/waitlist/waiting-user/promote")
    assert promoted.status_code == 200
    assert promoted.json()["success"] is True
    assert promoted.json()["user"]["userId"] == "waiting-user"
    assert len(client.get("/gym/active").json()) == 20
    assert client.get("/gym/waitlist").json() == []
