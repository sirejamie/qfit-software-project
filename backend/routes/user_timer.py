from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase_client import supabase


# Create the User Timer router
router = APIRouter(
    prefix="/api/timer",
    tags=["User Timer"]
)

# Configure Bearer token authentication
security = HTTPBearer(auto_error=False)


# -----------------------------------------
# 1. AUTHENTICATE THE CURRENT USER
# -----------------------------------------

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Identify the logged-in student using their
    Supabase authentication token.
    """

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid authorization token."
        )

    try:
        response = supabase.auth.get_user(
            credentials.credentials
        )

        if not response.user:
            raise HTTPException(
                status_code=401,
                detail="Invalid access token."
            )

        return response.user

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Authentication failed."
        )


# -----------------------------------------
# 2. CALCULATE REMAINING SESSION TIME
# -----------------------------------------

def calculate_remaining_time(expires_at):
    """
    Calculate how many seconds remain
    before the gym session expires.
    """

    if expires_at is None:
        return None

    expiration = datetime.fromisoformat(
        expires_at.replace("Z", "+00:00")
    )

    now = datetime.now(timezone.utc)

    remaining_seconds = max(
        0,
        int((expiration - now).total_seconds())
    )

    return remaining_seconds


# -----------------------------------------
# 3. GET THE USER'S GYM SESSION TIMER
# -----------------------------------------

@router.get("/")
def get_user_timer(
    user=Depends(get_current_user)
):
    """
    Retrieve the logged-in student's active
    gym session and remaining time.
    """

    try:
        # Retrieve the student's most recent active session
        response = (
            supabase.table("gym_sessions")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("start_time", desc=True)
            .limit(1)
            .execute()
        )

        # Check whether an active session exists
        if not response.data:
            return {
                "status": "no_session",
                "message": "No active gym session found."
            }

        session = response.data[0]

        # Retrieve the session expiration time
        expires_at = session["expires_at"]

        # Calculate remaining time
        remaining_seconds = calculate_remaining_time(
            expires_at
        )

        # Determine the session status
        status = "active"

        if remaining_seconds == 0:
            status = "expired"

        # Get the server's current time
        server_time = datetime.now(
            timezone.utc
        ).isoformat()

        # Return timer information
        return {
            "status": status,
            "session_id": session["id"],
            "start_time": session["start_time"],
            "expires_at": expires_at,
            "remaining_seconds": remaining_seconds,
            "timer_sync_status": session["timer_sync_status"],
            "server_time": server_time
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve gym session."
        )
