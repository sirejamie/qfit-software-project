from fastapi import APIRouter
from models.gym import Gym
from models.gym_manager import GymManager

router = APIRouter()

gym_manager = GymManager(Gym())

@router.get("/gym/status")
def get_gym_status():
    return gym_manager.get_capacity_status()