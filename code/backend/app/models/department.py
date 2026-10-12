from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Department(Base):
    __tablename__ = "departments"

    department_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    mail: Mapped[str] = mapped_column(String(255))

    reservations: Mapped[list["Reservation"]] = relationship(back_populates="department")
