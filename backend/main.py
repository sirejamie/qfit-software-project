from fastapi import FastAPI
from routes.gym import router as gym_router
from routes.demo import router as demo_router   # remove when done with demo

app = FastAPI()
app.include_router(gym_router)
app.include_router(demo_router)                 # remove when done with demo

@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}
