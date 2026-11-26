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
    """s0 to s19 scan the QR code and enter the gym."""
    for i in range(main.MAX_CAPACITY):
        client.post(f"/gym/enter/s{i}")


def test_tc6_1_1_1_queue_count_is_3():
    fill_gym()
    for name in ["s20", "s21", "s22"]:
        client.post(f"/gym/enter/{name}")
    assert client.get("/queue/count").json()["queue_length"] == 3


def test_tc6_1_2_1_queue_count_is_0_when_empty():
    assert client.get("/queue/count").json()["queue_length"] == 0


def test_tc6_2_1_1_waiting_time_calculated_when_full():
    fill_gym()
    client.post("/gym/enter/student1")
    data = client.get("/queue/wait-time?user_id=student1").json()
    assert data["estimated_wait_minutes"] > 0


def test_tc6_2_2_1_queue_updates_when_user_leaves():
    fill_gym()
    client.post("/gym/enter/student1")
    client.post("/gym/enter/student2")
    before = client.get("/queue/wait-time?user_id=student2").json()
    assert before["position"] == 2
    client.post("/gym/leave/s0")  # student1 is admitted
    after = client.get("/queue/wait-time?user_id=student2").json()
    assert after["queue_length"] == 1
    assert after["position"] == 1


def test_tc6_3_1_1_qr_deactivated_and_wait_displayed():
    fill_gym()
    client.post("/gym/enter/student1")
    data = client.get("/queue/wait-time?user_id=student1").json()
    assert data["qr_active"] is False
    assert data["estimated_wait_minutes"] is not None


def test_tc6_3_2_1_no_wait_time_when_qr_active():
    data = client.get("/queue/wait-time").json()
    assert data["qr_active"] is True
    assert data["estimated_wait_minutes"] is None