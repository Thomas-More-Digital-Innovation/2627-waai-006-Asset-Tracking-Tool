from sqlalchemy.orm import Session

from ..models import DayOfWeek

DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]


def seed_days_of_week(session: Session) -> None:
    for day_of_week_id, name in enumerate(DAYS, start=1):
        if session.get(DayOfWeek, day_of_week_id) is None:
            session.add(DayOfWeek(day_of_week_id=day_of_week_id, name=name))
