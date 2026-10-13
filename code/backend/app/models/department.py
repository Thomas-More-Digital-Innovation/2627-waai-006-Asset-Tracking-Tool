from sqlalchemy import String, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Department(Base):
    __tablename__ = "departments"

    department_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    mail: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true(), nullable=False)

    reservations: Mapped[list["Reservation"]] = relationship(back_populates="department")
