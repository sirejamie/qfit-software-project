# DEMO ONLY
# Delete once real checkins are implemented

from fastapi import APIRouter, HTTPException

from routes.auth import is_user_blacklisted
from routes.gym import gym_manager

router = APIRouter(prefix="/demo", tags=["demo (temporary)"])

@router.post("/checkin/{user_id}")
def demo_check_in(user_id: str):
    if is_user_blacklisted(user_id):
        raise HTTPException(
            status_code=403,
            detail="Blacklisted accounts cannot join the gym queue.",
        )
    gym_manager.gym.session_store.add(user_id)
    return gym_manager.get_capacity_status()

@router.post("/checkout/{user_id}")
def demo_check_out(user_id: str):
    gym_manager.gym.session_store.remove(user_id)
    return gym_manager.get_capacity_status()

@router.post("/fill/{n}")
def demo_fill(n: int):
    for i in range(n):
        gym_manager.gym.session_store.add(f"demo-{i}")
    return gym_manager.get_capacity_status()

@router.post("/reset")
def demo_reset():
    gym_manager.gym.reset()
    return gym_manager.get_capacity_status()