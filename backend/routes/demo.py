# DEMO ONLY
# Delete once real checkins are implemented

from fastapi import APIRouter

from models.session_store import InMemorySessionStore
from routes.gym import gym_manager

router = APIRouter(prefix="/demo", tags=["demo (temporary)"])

@router.post("/checkin/{student_id}")
def demo_check_in(student_id: str):
    gym_manager.gym.session_store.add(student_id)
    return gym_manager.get_capacity_status()

@router.post("/checkout/{student_id}")
def demo_check_out(student_id: str):
    gym_manager.gym.session_store.remove(student_id)
    return gym_manager.get_capacity_status()

@router.post("/fill/{n}")
def demo_fill(n: int):
    for i in range(n):
        gym_manager.gym.session_store.add(f"demo-{i}")
    return gym_manager.get_capacity_status()

@router.post("/reset")
def demo_reset():
    gym_manager.gym.session_store = InMemorySessionStore()
    return gym_manager.get_capacity_status()