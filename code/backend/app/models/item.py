from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Item(Base):
    __tablename__ = "items"

    item_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    photo: Mapped[str | None] = mapped_column(String(255))
    detail: Mapped[str | None] = mapped_column(Text)
    count: Mapped[int]
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.category_id"))

    category: Mapped["Category"] = relationship(back_populates="items")
    reservation_items: Mapped[list["ReservationItem"]] = relationship(back_populates="item")
    problems: Mapped[list["ItemProblem"]] = relationship(back_populates="item")
