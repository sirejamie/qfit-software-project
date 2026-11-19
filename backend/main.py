from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.user_timer import router as user_timer_router

app = FastAPI(title="QFit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(user_timer_router)


@app.get("/")
def home():
    return {"message": "QFit Backend Running"}

    