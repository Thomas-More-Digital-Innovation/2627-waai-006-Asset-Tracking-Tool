import os
import secrets
import urllib.error
from typing import Annotated, Literal

import jwt
from fastapi import APIRouter, Cookie, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlalchemy import select

from .. import sso
from ..dependencies import CurrentUser, DbSession
from ..models import User
from ..security import (
    ACCESS_TOKEN_COOKIE,
    ACCESS_TOKEN_MAX_AGE,
    AUTH_METHOD,
    create_access_token,
    hash_password,
    verify_password,
)

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
SSO_STATE_COOKIE = "sso_state"
SSO_STATE_MAX_AGE = 60 * 10

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthMethodResponse(BaseModel):
    method: Literal["email", "sso"]


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


def set_access_token_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        ACCESS_TOKEN_COOKIE,
        create_access_token(user_id),
        max_age=ACCESS_TOKEN_MAX_AGE,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )


def require_auth_method(method: str) -> None:
    if AUTH_METHOD != method:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Deze manier van inloggen staat uit")


@router.get("/method", response_model=AuthMethodResponse)
def auth_method():
    return {"method": AUTH_METHOD}


@router.post("/login", response_model=UserResponse)
def login(credentials: LoginRequest, response: Response, db: DbSession):
    require_auth_method("email")
    user = db.scalars(select(User).where(User.email == credentials.email.strip().lower())).first()
    if (
        user is None
        or not user.is_active
        or user.password is None
        or not verify_password(credentials.password, user.password)
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mailadres of wachtwoord is onjuist")

    set_access_token_cookie(response, user.user_id)
    return user


@router.get("/sso/login")
def sso_login():
    require_auth_method("sso")
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)

    response = RedirectResponse(sso.authorization_url(state, nonce))
    # Remembers which login this browser started, the callback checks it against what Microsoft sends back
    response.set_cookie(
        SSO_STATE_COOKIE,
        f"{state}:{nonce}",
        max_age=SSO_STATE_MAX_AGE,
        path="/api/auth/sso",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )
    return response


def split_name(name: str, email: str) -> tuple[str, str]:
    # Microsoft gives the full name, the first word becomes the first name
    parts = name.split(maxsplit=1)
    if not parts:
        return email.split("@")[0][:255], "-"
    return parts[0][:255], (parts[1] if len(parts) > 1 else "-")[:255]


# Microsoft sends the browser here after the user logged in, with a code and the state from sso_login
@router.get("/sso/callback")
def sso_callback(
    db: DbSession,
    code: str | None = None,
    state: str | None = None,
    sso_state: Annotated[str | None, Cookie(alias=SSO_STATE_COOKIE)] = None,
):
    require_auth_method("sso")

    # Every outcome ends here: back to the frontend, with an error code for the login page or logged in
    def finish(error: str | None = None, user_id: int | None = None) -> RedirectResponse:
        response = RedirectResponse(f"/?login_error={error}" if error else "/")
        # The state is only valid for one attempt, so it is removed whatever the outcome
        response.delete_cookie(SSO_STATE_COOKIE, path="/api/auth/sso", httponly=True, secure=COOKIE_SECURE, samesite="lax")
        if user_id is not None:
            set_access_token_cookie(response, user_id)
        return response

    # The state from Microsoft must match the cookie, so only a login this browser started is accepted (CSRF).
    # compare_digest compares in constant time, so the state cannot be guessed from response times.
    expected_state, _, nonce = (sso_state or "").partition(":")
    if not code or not state or not expected_state or not secrets.compare_digest(state, expected_state):
        return finish("sso_failed")

    # Trades the code for an ID token and checks its signature, app, tenant, expiry and nonce
    try:
        claims = sso.fetch_id_token_claims(code, nonce)
    except (urllib.error.URLError, KeyError, ValueError, jwt.PyJWTError):
        return finish("sso_failed")

    # Not every account has an email claim, the user principal name is then used instead
    email = str(claims.get("email") or claims.get("preferred_username") or "").strip().lower()
    if not email:
        return finish("sso_no_email")

    # An existing user, such as the seeded admin or one an admin added, is matched by email
    user = db.scalars(select(User).where(User.email == email)).first()
    if user is None:
        # Everyone of the organisation may log in, a new account starts as a normal user
        firstname, lastname = split_name(str(claims.get("name") or ""), email)
        user = User(firstname=firstname, lastname=lastname, email=email, is_admin=False)
        db.add(user)
        db.commit()
    if not user.is_active:
        return finish("inactive")

    # From here on the user is logged in with our own access token, the same as with email
    return finish(user_id=user.user_id)


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
    require_auth_method("email")
    if current_user.password is None or not verify_password(passwords.current_password, current_user.password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Huidig wachtwoord is onjuist")

    current_user.password = hash_password(passwords.new_password)
    db.commit()
