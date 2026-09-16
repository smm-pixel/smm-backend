"""Centralized runtime configuration for the FastAPI backend."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env")

READ_LEVEL = ("admin", "direktur", "bendahara", "pengawas", "penasihat")
REPORT_READ_LEVEL = READ_LEVEL + ("pengelola",)
WRITE_LEVEL = ("admin", "direktur", "bendahara")
ADMIN_LEVEL = ("admin",)
READONLY_ROLES = ("pengawas", "penasihat")

API_PREFIX = "/api"
APP_TITLE = "BUMDES Karya Raharja API"
def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} wajib dikonfigurasi")
    return value


CORS_ORIGINS = [origin.strip().rstrip("/") for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]

DATABASE_URL = _required_env("DATABASE_URL")
JWT_SECRET = _required_env("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 7
JWT_COOKIE_NAME = "bumdes_token"

__all__ = ["ROOT_DIR", "READ_LEVEL", "REPORT_READ_LEVEL", "WRITE_LEVEL", "ADMIN_LEVEL", "READONLY_ROLES", "API_PREFIX", "APP_TITLE", "CORS_ORIGINS", "DATABASE_URL", "JWT_SECRET", "JWT_ALGORITHM", "JWT_EXPIRE_HOURS", "JWT_COOKIE_NAME"]
