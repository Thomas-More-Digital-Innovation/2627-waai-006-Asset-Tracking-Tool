from ..database import SessionLocal
from .admin_user import seed_admin_user
from .day_of_week import seed_days_of_week


def run_seeders() -> None:
    with SessionLocal() as session:
        seed_days_of_week(session)
        seed_admin_user(session)
        session.commit()
