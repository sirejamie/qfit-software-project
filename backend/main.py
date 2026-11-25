from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.auth import router as auth_router
from routes.demo import router as demo_router
from routes.gym import router as gym_router

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(gym_router)
app.include_router(demo_router)
app.include_router(auth_router)

@app.get("/")
def root():
    return "hello, world"


@app.get("/health")
def health():
    return {"status": "ok"}
