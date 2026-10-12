from contextlib import asynccontextmanager

from fastapi import FastAPI

from .database import engine
from .models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/")
def root():
    return {"status": "ok"}
