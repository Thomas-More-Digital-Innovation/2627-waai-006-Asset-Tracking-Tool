import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import User
from ..security import AUTH_METHOD, hash_password


def seed_admin_user(session: Session) -> None:
    # With SSO the admin is optional, it logs in with Microsoft and so gets no password
    if AUTH_METHOD == "sso" and not os.environ.get("ADMIN_EMAIL", "").strip():
        return

    email = os.environ["ADMIN_EMAIL"].strip().lower()
    if session.scalars(select(User).where(User.email == email)).first() is None:
        session.add(
            User(
                firstname="Admin",
                lastname="WaaiTrack",
                email=email,
                password=hash_password(os.environ["ADMIN_PASSWORD"]) if AUTH_METHOD == "email" else None,
                is_admin=True,
            )
        )
