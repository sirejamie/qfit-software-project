from datetime import datetime
from math import ceil

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Gym Queue API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_CAPACITY = 5
AVG_WORKOUT_MINUTES = 60

gym_users: dict[str, datetime] = {}  # user_id -> entry time
queue: list[str] = []                # user_ids waiting, in order


# ---------- core logic ----------
def get_queue_count() -> int:                      # SR-1
    return len(queue)


def is_qr_active() -> bool:
    return len(gym_users) < MAX_CAPACITY


def calculate_wait_minutes(position: int) -> int:  # SR-2
    """Minutes until the person at `position` (1-based) can enter,
    based on when current gym users are expected to leave."""
    if position <= 0 or not gym_users:
        return 0
    now = datetime.now()
    remaining = sorted(
        max(0.0, AVG_WORKOUT_MINUTES - (now - entered).total_seconds() / 60)
        for entered in gym_users.values()
    )
    wave, i = divmod(position - 1, len(remaining))
    return ceil(remaining[i] + wave * AVG_WORKOUT_MINUTES)


# ---------- endpoints ----------
@app.get("/queue/count")
def queue_count():
    return {"queue_length": get_queue_count()}


@app.get("/queue/wait-time")                       # SR-3
def wait_time(user_id: str | None = None):
    if is_qr_active():  # TS-6: no waiting time while QR is active
        return {"qr_active": True, "queue_length": 0,
                "position": None, "estimated_wait_minutes": None}
    if user_id in queue:
        position = queue.index(user_id) + 1
    else:
        position = len(queue) + 1  # where they'd be if they joined now
    return {
        "qr_active": False,
        "queue_length": get_queue_count(),
        "position": position,
        "estimated_wait_minutes": calculate_wait_minutes(position),
    }


@app.post("/gym/enter/{user_id}")
def enter(user_id: str):
    if user_id in gym_users or user_id in queue:
        return {"status": "already_present"}
    if is_qr_active():
        gym_users[user_id] = datetime.now()
        return {"status": "entered"}
    queue.append(user_id)
    return {"status": "queued", "position": len(queue)}


@app.post("/gym/leave/{user_id}")
def leave(user_id: str):
    gym_users.pop(user_id, None)
    while queue and len(gym_users) < MAX_CAPACITY:  # promote next in line
        gym_users[queue.pop(0)] = datetime.now()
    return {"status": "left"}
