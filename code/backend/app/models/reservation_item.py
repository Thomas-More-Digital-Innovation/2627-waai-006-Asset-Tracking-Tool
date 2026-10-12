from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ReservationItem(Base):
    __tablename__ = "reservation_items"

    reservation_item_id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.item_id"))
    reservation_id: Mapped[int] = mapped_column(ForeignKey("reservations.reservation_id"))
    count: Mapped[int]

    item: Mapped["Item"] = relationship(back_populates="reservation_items")
    reservation: Mapped["Reservation"] = relationship(back_populates="reservation_items")
