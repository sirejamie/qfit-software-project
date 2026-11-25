from typing import Any

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field, field_validator

from models.gym import Gym
from models.gym_manager import GymManager

router = APIRouter()

gym_manager = GymManager(Gym())


class CheckInRequest(BaseModel):
    userId: str = Field(min_length=1)
    fullName: str = Field(min_length=1)
    durationMinutes: int = Field(default=60, gt=0)
    notify5MinBefore: bool = False

    @field_validator("userId", "fullName")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field must not be blank.")
        return value


class CheckoutRequest(BaseModel):
    removedBy: str = "self"


class WaitlistNotificationRequest(BaseModel):
    notify5MinBefore: bool


class SettingsUpdateRequest(BaseModel):
    maxCapacity: int | None = Field(default=None, gt=0)
    defaultDurationMin: int | None = Field(default=None, gt=0)
    manualQrDeactivated: bool | None = None


class ResyncRequest(BaseModel):
    syncFailed: bool = False


@router.get("/gym/status")
def get_gym_status():
    return gym_manager.get_capacity_status()


@router.post("/gym/checkin", status_code=201)
def gym_checkin(request: CheckInRequest):
    return gym_manager.gym.check_in(request.model_dump())


@router.post("/gym/checkout/{userId}", status_code=204)
def gym_checkout(userId: str, request: CheckoutRequest) -> Response:
    if not gym_manager.gym.check_out(userId, request.removedBy):
        raise HTTPException(status_code=404, detail="User is not in the active queue.")
    return Response(status_code=204)


@router.get("/gym/active")
def get_gym_active() -> list[dict[str, Any]]:
    return gym_manager.gym.get_active_queue()


@router.get("/gym/waitlist")
def get_gym_waitlist() -> list[dict[str, Any]]:
    return gym_manager.gym.get_waitlist_queue()


@router.post("/gym/waitlist/{userId}/promote")
def promote_waitlisted_user(userId: str):
    user = gym_manager.gym.promote_from_waitlist(userId)
    if user is None:
        return {"success": False}
    return {"success": True, "user": user}


@router.delete("/gym/waitlist/{userId}", status_code=204)
def remove_waitlisted_user(userId: str) -> Response:
    if not gym_manager.gym.remove_from_waitlist(userId):
        raise HTTPException(status_code=404, detail="User is not on the waitlist.")
    return Response(status_code=204)


@router.patch("/gym/waitlist/{userId}")
def update_waitlist_notification(userId: str, request: WaitlistNotificationRequest):
    user = gym_manager.gym.update_waitlist_notification(userId, request.notify5MinBefore)
    if user is None:
        raise HTTPException(status_code=404, detail="User is not on the waitlist.")
    return {"user": user}


@router.patch("/gym/active/{userId}/resync")
def resync_user(userId: str, request: ResyncRequest):
    user = gym_manager.gym.session_store.update_active(
        userId,
        {"syncFailed": request.syncFailed},
    )
    if user is None:
        raise HTTPException(status_code=404, detail="User is not in the active queue.")
    return {"user": user}


@router.get("/gym/settings")
def get_gym_settings():
    return gym_manager.gym.get_settings()


@router.put("/gym/settings")
def update_gym_settings(request: SettingsUpdateRequest):
    return gym_manager.gym.update_settings(
        request.model_dump(exclude_unset=True, exclude_none=True)
    )


@router.get("/gym/notices/{userId}")
def get_checkout_notice(userId: str):
    return gym_manager.gym.session_store.get_checkout_notice(userId)


@router.delete("/gym/notices/{userId}", status_code=204)
def consume_checkout_notice(userId: str) -> Response:
    gym_manager.gym.session_store.consume_checkout_notice(userId)
    return Response(status_code=204)
