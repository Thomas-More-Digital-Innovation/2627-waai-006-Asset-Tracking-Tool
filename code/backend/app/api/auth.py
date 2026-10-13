import os
from typing import Annotated

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlalchemy import select

from ..dependencies import CurrentUser, DbSession
from ..models import User
from ..security import (
    ACCESS_TOKEN_COOKIE,
    ACCESS_TOKEN_MAX_AGE,
    create_access_token,
    hash_password,
    verify_password,
)

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    firstname: str
    lastname: str
    email: str
    is_admin: bool


Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class ProfileUpdate(BaseModel):
    firstname: Name
    lastname: Name


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


@router.post("/login", response_model=UserResponse)
def login(credentials: LoginRequest, response: Response, db: DbSession):
    user = db.scalars(select(User).where(User.email == credentials.email.strip().lower())).first()
    if user is None or user.password is None or not verify_password(credentials.password, user.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mailadres of wachtwoord is onjuist")

    response.set_cookie(
        ACCESS_TOKEN_COOKIE,
        create_access_token(user.user_id),
        max_age=ACCESS_TOKEN_MAX_AGE,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(ACCESS_TOKEN_COOKIE, httponly=True, secure=COOKIE_SECURE, samesite="lax")


@router.get("/me", response_model=UserResponse)
def me(current_user: CurrentUser):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_profile(profile: ProfileUpdate, current_user: CurrentUser, db: DbSession):
    current_user.firstname = profile.firstname
    current_user.lastname = profile.lastname
    db.commit()
    return current_user


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(passwords: PasswordChange, current_user: CurrentUser, db: DbSession):
    if current_user.password is None or not verify_password(passwords.current_password, current_user.password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Huidig wachtwoord is onjuist")

    current_user.password = hash_password(passwords.new_password)
    db.commit()
