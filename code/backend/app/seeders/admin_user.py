import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import User
from ..security import hash_password


def seed_admin_user(session: Session) -> None:
    email = os.environ["ADMIN_EMAIL"].strip().lower()
    if session.scalars(select(User).where(User.email == email)).first() is None:
        session.add(
            User(
                firstname="Admin",
                lastname="WaaiTrack",
                email=email,
                password=hash_password(os.environ["ADMIN_PASSWORD"]),
                is_admin=True,
            )
        )
