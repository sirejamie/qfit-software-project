from fastapi import FastAPI
import routes.gym as gym

app = FastAPI()

app.include_router(gym.router)

@app.get("/health")
def health():
    return {"status": "ok"}