from contextlib import asynccontextmanager

from fastapi import FastAPI

from .database import engine
from .models import Base
from .seeders import run_seeders


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    run_seeders()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/")
def root():
    return {"status": "ok"}
