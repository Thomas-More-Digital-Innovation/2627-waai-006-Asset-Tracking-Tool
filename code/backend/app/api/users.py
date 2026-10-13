from typing import Annotated

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..dependencies import AdminUser, DbSession
from ..models import User
from ..security import hash_password
from .auth import Name, UserResponse

router = APIRouter(prefix="/users", tags=["users"])

Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
]
Password = Annotated[str, StringConstraints(min_length=8, max_length=72)]


class ManagedUserResponse(UserResponse):
    is_active: bool


class UserCreate(BaseModel):
    firstname: Name
    lastname: Name
    email: Email
    is_admin: bool = False
    password: Password


class UserUpdate(BaseModel):
    firstname: Name
    lastname: Name
    email: Email
    is_admin: bool = False
    # Left out or null means the password stays the same
    password: Password | None = None


def find_user_by_email(db: Session, email: str) -> User | None:
    return db.scalars(select(User).where(User.email == email)).first()


def get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Gebruiker niet gevonden")
    return user


@router.get("", response_model=list[ManagedUserResponse])
def list_users(admin: AdminUser, db: DbSession):
    # Active users first, inactive users at the bottom
    return db.scalars(select(User).order_by(User.is_active.desc(), User.lastname, User.firstname)).all()


@router.post("", response_model=ManagedUserResponse, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, admin: AdminUser, db: DbSession):
    if find_user_by_email(db, data.email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Er bestaat al een gebruiker met dit e-mailadres")

    user = User(
        firstname=data.firstname,
        lastname=data.lastname,
        email=data.email,
        is_admin=data.is_admin,
        password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    return user


@router.put("/{user_id}", response_model=ManagedUserResponse)
def update_user(user_id: int, data: UserUpdate, admin: AdminUser, db: DbSession):
    user = get_user(db, user_id)
    existing = find_user_by_email(db, data.email)
    if existing is not None and existing.user_id != user.user_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Er bestaat al een gebruiker met dit e-mailadres")
    if user.user_id == admin.user_id and not data.is_admin:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Je kunt je eigen beheerdersrechten niet intrekken")

    user.firstname = data.firstname
    user.lastname = data.lastname
    user.email = data.email
    user.is_admin = data.is_admin
    if data.password:
        user.password = hash_password(data.password)
    db.commit()
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(user_id: int, admin: AdminUser, db: DbSession):
    user = get_user(db, user_id)
    if user.user_id == admin.user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Je kunt jezelf niet verwijderen")

    # Users are never removed, so existing reservations keep their user
    user.is_active = False
    db.commit()


@router.post("/{user_id}/activate", response_model=ManagedUserResponse)
def activate_user(user_id: int, admin: AdminUser, db: DbSession):
    user = get_user(db, user_id)
    user.is_active = True
    db.commit()
    return user
