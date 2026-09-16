"""JWT auth helpers."""
from datetime import datetime, timedelta, timezone

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS, JWT_COOKIE_NAME
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext

SECRET_KEY = JWT_SECRET
ALGORITHM = JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_HOURS = JWT_EXPIRE_HOURS
COOKIE_NAME = JWT_COOKIE_NAME

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def create_access_token(user_id: str, role: str, session_version: int = 0, extra: Optional[dict] = None) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "session_version": session_version,
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesi tidak valid atau sudah kedaluwarsa")


async def get_current_user_payload(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
) -> dict:
    """Prefer HttpOnly cookie; fall back to Authorization: Bearer for backwards compat."""
    if not token:
        token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return decode_token(token)


def require_roles(*allowed_roles):
    async def checker(payload: dict = Depends(get_current_user_payload)):
        if payload.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"Butuh role: {', '.join(allowed_roles)}")
        return payload
    return checker

