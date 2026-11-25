from models.gym import Gym
from models.gym_manager import GymManager


# helper
def make_gym(people_inside: int) -> Gym:
    gym = Gym()
    for i in range(people_inside):
        gym.session_store.add(f"user-{i}")
    return gym

# TS-1
def test_occupancy_is_reported_correctly():
    assert make_gym(7).get_occupancy() == 7

def test_status_includes_count():
    status = GymManager(make_gym(8)).get_capacity_status()
    assert status["current_count"] == 8
    assert status["max_capacity"] == 20
    assert status["is_full"] is False

# TS-2
def test_count_updates_when_user_leaves():
    gym = make_gym(20)
    manager = GymManager(gym)

    assert manager.is_gym_full() is True

    gym.session_store.remove("user-0")

    assert gym.get_occupancy() == 19
    assert manager.is_gym_full() is False
    assert manager.get_capacity_status()["qr_active"] is True

def test_not_full_one_below_capacity():
    assert GymManager(make_gym(19)).is_gym_full() is False

# TS-3
def test_qr_code_inactive_when_full():
    assert GymManager(make_gym(20)).get_capacity_status()["qr_active"] is False

def test_full_at_capacity():
    assert GymManager(make_gym(20)).is_gym_full() is True

# TS-4
def test_not_full_below_capacity():
    assert GymManager(make_gym(12)).is_gym_full() is False

def test_qr_active_below_capacity():
    assert GymManager(make_gym(12)).get_capacity_status()["qr_active"] is True

# TS-5
def test_message_shown_when_full():
    status = GymManager(make_gym(20)).get_capacity_status()
    assert status["message"] == GymManager.FULL_MESSAGE

# TS-6
def test_no_message_below_capacity():
    status = GymManager(make_gym(12)).get_capacity_status()
    assert status["message"] is None

# additional test
def test_full_above_capacity():
    assert GymManager(make_gym(22)).is_gym_full() is True