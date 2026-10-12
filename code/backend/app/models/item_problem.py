from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ItemProblem(Base):
    __tablename__ = "item_problems"

    item_problem_id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.item_id"))
    note: Mapped[str] = mapped_column(Text)

    item: Mapped["Item"] = relationship(back_populates="problems")
