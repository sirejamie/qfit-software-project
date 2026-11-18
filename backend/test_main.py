import pytest
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def reset_state():
    """Start every test with an empty gym and an empty queue."""
    main.gym_users.clear()
    main.queue.clear()


def fill_gym():
    for i in range(main.MAX_CAPACITY):
        client.post(f"/gym/enter/u{i}")


# TS-1 (AC-1): returns the correct number of students in the queue
def test_ts1_returns_correct_queue_count():
    fill_gym()
    client.post("/gym/enter/waiter1")
    client.post("/gym/enter/waiter2")
    assert client.get("/queue/count").json()["queue_length"] == 2

# TS-2 (AC-1): returns zero when the queue is empty
def test_ts2_returns_zero_when_queue_empty():
    assert client.get("/queue/count").json()["queue_length"] == 0

# TS-3 (AC-2): calculates the estimated wait when the gym is full
def test_ts3_calculates_wait_when_gym_full():
    fill_gym()
    client.post("/gym/enter/waiter")
    data = client.get("/queue/wait-time?user_id=waiter").json()
    assert data["estimated_wait_minutes"] > 0


# TS-4 (AC-2): updates when student leave the gym
def test_ts4_updates_when_user_leaves():
    fill_gym()
    client.post("/gym/enter/waiter1")
    client.post("/gym/enter/waiter2")
    before = client.get("/queue/wait-time?user_id=waiter2").json()
    assert before["position"] == 2

    client.post("/gym/leave/u0")  # places the student into the gym queue
    after = client.get("/queue/wait-time?user_id=waiter2").json()
    assert after["position"] == 1
    assert after["queue_length"] == 1


# TS-5 (AC-3): QR is deactivated and the estimated wait is displayed
def test_ts5_qr_deactivated_and_wait_displayed():
    fill_gym()
    client.post("/gym/enter/waiter")
    data = client.get("/queue/wait-time?user_id=waiter").json()
    assert data["qr_active"] is False
    assert data["estimated_wait_minutes"] is not None


# TS-6 (AC-3): no waiting time is shown while the QR code is active
def test_ts6_no_wait_time_when_qr_active():
    data = client.get("/queue/wait-time").json()
    assert data["qr_active"] is True
    assert data["estimated_wait_minutes"] is None