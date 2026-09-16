from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr
from .base import BaseRecord, now_utc

class UserRole:
    ADMIN = "admin"
    DIREKTUR = "direktur"
    BENDAHARA = "bendahara"
    PENGELOLA = "pengelola"
    PENGAWAS = "pengawas"
    PENASIHAT = "penasihat"

class User(BaseRecord):
    email: EmailStr
    username: str
    name: str
    role: str  # admin | direktur | bendahara | pengelola | pengawas | penasihat
    unit_usaha_id: Optional[str] = None  # for pengelola only
    password_hash: str
    must_change_password: bool = False
    session_version: int = 0
    active: bool = True
    # Period Access Control: array of blocked "YYYY-MM" months for transaction actions
    blocked_periods: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=now_utc)

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    name: str
    role: str
    password: str
    unit_usaha_id: Optional[str] = None

class UserLogin(BaseModel):
    username: str  # username or email
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    username: str
    name: str
    role: str
    unit_usaha_id: Optional[str] = None
    active: bool = True
    must_change_password: bool = False
    blocked_periods: List[str] = Field(default_factory=list)

class PasswordResetRequest(BaseModel):
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    username: str = Field(min_length=3, max_length=60)
