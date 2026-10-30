import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_COOKIE = "access_token"
ACCESS_TOKEN_MAX_AGE = 60 * 60 * 8

# "email" logs in with a password, "sso" logs in with a Microsoft account
AUTH_METHOD = os.environ.get("AUTH_METHOD", "email").strip().lower()
if AUTH_METHOD not in ("email", "sso"):
    raise RuntimeError('AUTH_METHOD must be "email" or "sso"')


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(user_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ACCESS_TOKEN_MAX_AGE)
    return jwt.encode({"sub": str(user_id), "exp": expires_at}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    return int(payload["sub"])
