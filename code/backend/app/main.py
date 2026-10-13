from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api import auth, categories, departments, settings, users
from .database import engine
from .models import Base
from .seeders import run_seeders


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    run_seeders()
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(auth.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(users.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok"}
