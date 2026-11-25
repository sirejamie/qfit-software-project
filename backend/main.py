from fastapi import FastAPI
from routes.gym import router as gym_router
from routes.demo import router as demo_router   # remove when done with demo
from fastapi.middleware.cors import CORSMiddleware

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

@app.get("/")
def root():
    return "hello, world"
    

@app.get("/health")
def health():
    return {"status": "ok"}
