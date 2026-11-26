import os
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from constants.demo_users import DEMO_USERS
from lib.supabase_client import get_supabase_client

router = APIRouter()

class LoginRequest(BaseModel):
    userIdentifier: str = Field(min_length=1)
    password: str = Field(min_length=1)

    @field_validator("userIdentifier")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise ValueError("A user ID is required.")
        return value


class RegistrationRequest(BaseModel):
    userIdentifier: str = Field(min_length=1)
    fullName: str = Field(min_length=1)
    password: str = Field(min_length=4)
    role: Literal["user", "staff"] = "user"
    email: str | None = None

    @field_validator("userIdentifier", "fullName", "password")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field must not be blank.")
        return value


class PasswordResetRequest(BaseModel):
    userIdentifier: str = Field(min_length=1)
    newPassword: str = Field(min_length=4)

    @field_validator("userIdentifier", "newPassword")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field must not be blank.")
        return value


def _public_user(user: dict[str, object]) -> dict[str, object]:
    return {key: value for key, value in user.items() if key != "password"}


def is_user_blacklisted(user_identifier: str) -> bool:
    if os.getenv("STORE_BACKEND", "memory").strip().lower() != "supabase":
        return False

    users = (
        get_supabase_client()
        .table("users")
        .select("is_blacklisted")
        .eq("user_identifier", user_identifier)
        .limit(1)
        .execute()
        .data
    )
    if not users:
        raise HTTPException(
            status_code=500,
            detail="Unable to load the account status from Supabase.",
        )
    return bool(users[0].get("is_blacklisted", False))


@router.post("/auth/login")
def auth_login(request: LoginRequest):
    user = next(
        (
            candidate
            for candidate in DEMO_USERS
            if candidate["userIdentifier"] == request.userIdentifier
            and candidate["password"] == request.password
        ),
        None,
    )
    if user is None:
        raise HTTPException(status_code=401, detail="Incorrect username or password. Try again.")
    public_user = _public_user(user)
    public_user["isBlacklisted"] = is_user_blacklisted(request.userIdentifier)
    return {"user": public_user}


@router.post("/auth/register", status_code=201)
def auth_register(request: RegistrationRequest):
    identifier = request.userIdentifier.strip().upper()
    existing = next(
        (user for user in DEMO_USERS if user["userIdentifier"] == identifier),
        None,
    )
    if existing:
        raise HTTPException(status_code=409, detail="An account with this ID is already registered.")

    user = {
        "userId": identifier,
        "userIdentifier": identifier,
        "fullName": request.fullName.strip(),
        "email": request.email.strip() if request.email else f"{identifier.lower()}@qfit.uwi.edu",
        "password": request.password.strip(),
        "role": request.role,
    }
    if not user["fullName"] or not user["password"]:
        raise HTTPException(status_code=422, detail="Name and password must not be blank.")

    DEMO_USERS.append(user)
    return {"user": _public_user(user)}


@router.post("/auth/password/reset")
def auth_password_reset(request: PasswordResetRequest):
    identifier = request.userIdentifier.strip().upper()
    user = next(
        (
            candidate
            for candidate in DEMO_USERS
            if candidate["userIdentifier"] == identifier
            or candidate["email"].upper() == identifier
        ),
        None,
    )
    if user is None:
        raise HTTPException(status_code=404, detail="No registered account found.")

    password = request.newPassword.strip()
    if len(password) < 4:
        raise HTTPException(status_code=422, detail="Password must be at least 4 characters.")
    user["password"] = password
    return {
        "success": True,
        "message": f"Password for {user['fullName']} has been reset successfully. You can now log in.",
    }
