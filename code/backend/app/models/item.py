from sqlalchemy import ForeignKey, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Item(Base):
    __tablename__ = "items"

    item_id: Mapped[int] = mapped_column(primary_key=True)
    article_number: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    photo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    count: Mapped[int] = mapped_column(nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.category_id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true(), nullable=False)

    category: Mapped["Category"] = relationship(back_populates="items")
    reservation_items: Mapped[list["ReservationItem"]] = relationship(back_populates="item")
    problems: Mapped[list["ItemProblem"]] = relationship(back_populates="item")
