from ..database import SessionLocal
from .day_of_week import seed_days_of_week


def run_seeders() -> None:
    with SessionLocal() as session:
        seed_days_of_week(session)
        session.commit()
