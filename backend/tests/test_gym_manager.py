from datetime import UTC, datetime, timedelta

from models.gym import Gym
from models.gym_manager import GymManager
from models.gym_queue import GymQueue
from models.gym_staff import GymStaff
from models.queue_entry import QueueEntry


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


def test_manager_processes_check_in_and_refreshes_staff_list():
    gym = Gym()
    manager = GymManager(gym)

    result = manager.process_check_in({"userId": "member-1", "fullName": "Member One"})

    assert result["status"] == "active"
    assert [user["userId"] for user in manager.gym_list] == ["member-1"]
    assert GymStaff(gym).view_gym_list() == manager.gym_list


def test_manager_waitlists_when_full_and_queue_returns_oldest_entry():
    gym = make_gym(20)
    manager = GymManager(gym)

    manager.process_check_in({"userId": "later", "fullName": "Later User"})
    result = manager.process_check_in({"userId": "earlier", "fullName": "Earlier User"})
    queue = GymQueue(gym.session_store)

    assert queue.get_next_user()["userId"] == "later"
    assert len(manager.gym_list) == 20
    assert result["message"] == GymManager.FULL_MESSAGE


def test_queue_entry_updates_state_when_promoted_or_removed():
    gym = make_gym(20)
    gym.check_in({"userId": "waiting", "fullName": "Waiting User"})
    entry = QueueEntry(gym.get_waitlist_queue()[0], gym.queue)

    assert entry.update_state("admitted") is True
    assert entry.status == "admitted"
    assert gym.get_waitlist_queue() == []
    assert entry.update_state("removed") is False


def test_gym_session_reports_remaining_time_and_ends_early():
    gym = Gym()
    joined_at = datetime.now(UTC).isoformat()
    gym.session_store.add(
        "member",
        {
            "userId": "member",
            "fullName": "Member",
            "joinedAt": joined_at,
            "durationMinutes": 30,
        },
    )
    session = gym.get_session("member")

    remaining = session.get_remaining_time()
    assert timedelta(0) < remaining <= timedelta(minutes=30)
    assert session.end_session() is True
    assert session.get_remaining_time() == timedelta(0)
    assert session.end_session() is False
    assert gym.get_occupancy() == 0


def test_gym_information_reports_capacity_and_occupancy():
    gym = Gym(capacity=1, operating_hours="6am-10pm")
    gym.session_store.add("member")

    assert gym.get_information() == {
        "capacity": 1,
        "occupancy": 1,
        "operatingHours": "6am-10pm",
        "isFull": True,
    }


def test_staff_removal_ends_user_session_with_notice():
    gym = Gym()
    gym.session_store.add("member")

    assert GymStaff(gym).remove_user("member") is True
    assert gym.get_occupancy() == 0
    assert gym.session_store.get_checkout_notice("member")["message"] == (
        "You have been removed from the queue."
    )
