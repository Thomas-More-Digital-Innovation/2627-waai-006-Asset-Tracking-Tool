from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class DayOfWeek(Base):
    __tablename__ = "days_of_week"

    day_of_week_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
