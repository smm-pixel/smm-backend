"""Reusable FastAPI dependencies and request-scope helpers."""
from typing import Optional
from fastapi import Depends, HTTPException
from services.jwt_service import get_current_user_payload
from config import READONLY_ROLES
from database import db
from models import User

async def user_from_payload(payload: dict) -> User:
    uid = payload.get("sub")
    doc = await db.users.select_one({"id": uid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="User tidak ditemukan")
    user = User(**doc)
    if payload.get("session_version", 0) != user.session_version:
        raise HTTPException(status_code=401, detail="Sesi kedaluwarsa, silakan login kembali")
    return user

async def scope_unit_for_pengelola(payload: dict, unit_usaha_id: Optional[str]) -> Optional[str]:
    if payload.get("role") == "pengelola":
        user = await user_from_payload(payload)
        if not user.unit_usaha_id:
            raise HTTPException(403, "Pengelola tidak memiliki unit usaha")
        return user.unit_usaha_id
    return unit_usaha_id

async def require_password_ready(payload: dict = Depends(get_current_user_payload)):
    user = await user_from_payload(payload)
    if user.must_change_password:
        raise HTTPException(status_code=403, detail="PASSWORD_CHANGE_REQUIRED")
    return payload


def require_not_readonly():
    async def checker(payload: dict = Depends(get_current_user_payload)):
        if payload.get("role") in READONLY_ROLES:
            raise HTTPException(status_code=403, detail="Role Anda hanya bisa membaca, tidak bisa mengubah data")
        return payload
    return checker

def fmt_rp(n: float) -> str:
    try:
        return "Rp " + f"{n:,.0f}".replace(",", ".")
    except Exception:
        return f"Rp {n}"

__all__ = ["user_from_payload", "scope_unit_for_pengelola", "require_password_ready", "require_not_readonly", "fmt_rp"]
