from datetime import datetime
from math import ceil

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.auth import router as auth_router
from routes.demo import router as demo_router
from routes.gym import router as gym_router

app = FastAPI(title="Gym Queue API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(gym_router)
app.include_router(demo_router)
app.include_router(auth_router)

@app.get("/")
def root():
    return "hello, world"


@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}
