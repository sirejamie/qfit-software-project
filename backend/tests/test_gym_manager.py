from models.gym import Gym
from models.gym_manager import GymManager

# TS-1
def test_occupancy_is_reported_correctly():
    assert Gym(occupancy = 7).get_occupancy() == 7

# TS-3
def test_qr_code_inactive_when_full():
    assert GymManager(Gym(occupancy = 20)).get_capacity_status()["qr_active"] is False

def test_full_at_capacity():
    assert GymManager(Gym(occupancy = 20)).is_gym_full() == True

# TS-4
def test_not_full_below_capacity():
    assert GymManager(Gym(occupancy = 19)).is_gym_full() == False

def test_qr_active_below_capacity():
    assert GymManager(Gym(capacity = 19)).get_capacity_status()["qr_active"] is True

# TS-5
def test_message_shown_when_full():
    status = GymManager(Gym(occupancy = 20)).get_capacity_status()
    assert status["message"] == GymManager.MESSAGE

# TS-6
def test_no_message_below_capacity():
    status = GymManager(Gym(occupancy = 19)).get_capacity_status()
    assert status["message"] is None

def test_full_above_capacity():
    assert GymManager(Gym(occupancy = 22)).is_gym_full() == True