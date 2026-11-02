import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api import auth, backup, categories, departments, items, problems, reservations, settings, users
from .database import engine
from .models import Base
from .reminders import MAIL_SENDER, run_reminders
from .seeders import run_seeders
from .upgrades import add_returned_at


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    add_returned_at(engine)
    run_seeders()
    # Reminders are only sent when a sender mailbox is set
    reminders = asyncio.create_task(run_reminders()) if MAIL_SENDER else None
    yield
    if reminders:
        reminders.cancel()


app = FastAPI(lifespan=lifespan)
app.include_router(auth.router, prefix="/api")
app.include_router(backup.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(items.router, prefix="/api")
app.include_router(problems.router, prefix="/api")
app.include_router(reservations.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(users.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok"}
