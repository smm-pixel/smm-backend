"""Reusable FastAPI dependencies — relational AsyncSession auth (no Mongo db)."""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import READONLY_ROLES
from infrastructure.database.connection import get_db
from infrastructure.database.models import User
from services.jwt_service import get_current_user_payload


async def get_current_user(
    payload: dict = Depends(get_current_user_payload),
    session: AsyncSession = Depends(get_db),
) -> User:
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await session.get(User, uid)
    if not user or not user.active:
        raise HTTPException(status_code=401, detail="User tidak ditemukan atau nonaktif")
    return user


async def user_from_payload(
    payload: dict,
    session: AsyncSession = Depends(get_db),
) -> User:
    return await get_current_user(payload=payload, session=session)


async def scope_unit_for_pengelola(
    payload: dict,
    unit_usaha_id: Optional[str],
    session: AsyncSession = Depends(get_db),
) -> Optional[str]:
    if payload.get("role") == "pengelola":
        user = await get_current_user(payload=payload, session=session)
        if not user.unit_usaha_id:
            raise HTTPException(status_code=403, detail="Pengelola tidak memiliki unit usaha")
        return user.unit_usaha_id
    return unit_usaha_id


async def require_password_ready(
    user: User = Depends(get_current_user),
    payload: dict = Depends(get_current_user_payload),
):
    # Relational User may not have must_change_password yet — skip if attr missing
    if getattr(user, "must_change_password", False):
        raise HTTPException(status_code=403, detail="PASSWORD_CHANGE_REQUIRED")
    return payload


def require_not_readonly():
    async def checker(payload: dict = Depends(get_current_user_payload)):
        if payload.get("role") in READONLY_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Role Anda hanya bisa membaca, tidak bisa mengubah data",
            )
        return payload

    return checker


def fmt_rp(n: float) -> str:
    try:
        return "Rp " + f"{n:,.0f}".replace(",", ".")
    except Exception:
        return f"Rp {n}"


__all__ = [
    "get_current_user",
    "user_from_payload",
    "scope_unit_for_pengelola",
    "require_password_ready",
    "require_not_readonly",
    "fmt_rp",
]
