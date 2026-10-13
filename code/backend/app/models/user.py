from sqlalchemy import String, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(primary_key=True)
    firstname: Mapped[str] = mapped_column(String(255))
    lastname: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255))
    password: Mapped[str | None] = mapped_column(String(255))
    is_admin: Mapped[bool]
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())

    reservations: Mapped[list["Reservation"]] = relationship(back_populates="user")
