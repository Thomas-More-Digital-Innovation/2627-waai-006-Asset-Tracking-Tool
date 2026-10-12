from datetime import date, datetime, time

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Reservation(Base):
    __tablename__ = "reservations"

    reservation_id: Mapped[int] = mapped_column(primary_key=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.department_id"))
    date_time: Mapped[datetime]
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"))
    start_time: Mapped[time]
    end_time: Mapped[time]
    start_date: Mapped[date]
    end_date: Mapped[date]

    department: Mapped["Department | None"] = relationship(back_populates="reservations")
    user: Mapped["User"] = relationship(back_populates="reservations")
    reservation_items: Mapped[list["ReservationItem"]] = relationship(back_populates="reservation")
