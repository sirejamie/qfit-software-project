from fastapi import APIRouter
from models.gym import Gym
from models.gym_manager import GymManager

router = APIRouter()

gym_manager = GymManager(Gym())

@router.get("/gym/status")
def get_gym_status():
    return gym_manager.get_capacity_status()

@router.get("/gym/active")
def get_gym_active():
    """
    Returns a list of all users currently in the gym with their session being active
    """
    return gym_manager.gym.get_active_queue()


@router.get("/gym/waitlist")
def get_gym_waitlist():
    """
    Returns a list of all users currently in the waitlist for the queue
    """
    return gym_manager.gym.get_waitlist_queue()
