from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import ACCESS_TOKEN_COOKIE, decode_access_token

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    access_token: Annotated[str | None, Cookie(alias=ACCESS_TOKEN_COOKIE)] = None,
) -> User:
    user_id = decode_access_token(access_token) if access_token else None
    user = db.get(User, user_id) if user_id is not None else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Niet ingelogd")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_admin_user(current_user: CurrentUser) -> User:
    if not current_user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Alleen voor beheerders")
    return current_user
