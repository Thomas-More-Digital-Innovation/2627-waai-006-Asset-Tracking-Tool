from datetime import time

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ApplicationSetting(Base):
    __tablename__ = "application_settings"

    application_setting_id: Mapped[int] = mapped_column(primary_key=True)
    is_summer_time: Mapped[bool] = mapped_column(nullable=False)
    summer_start_time: Mapped[time | None] = mapped_column(nullable=True)
    summer_end_time: Mapped[time | None] = mapped_column(nullable=True)
    summer_start_date_of_week: Mapped[int | None] = mapped_column(ForeignKey("days_of_week.day_of_week_id"), nullable=True)
    summer_end_date_of_week: Mapped[int | None] = mapped_column(ForeignKey("days_of_week.day_of_week_id"), nullable=True)

    summer_start_day: Mapped["DayOfWeek | None"] = relationship(foreign_keys=[summer_start_date_of_week])
    summer_end_day: Mapped["DayOfWeek | None"] = relationship(foreign_keys=[summer_end_date_of_week])
