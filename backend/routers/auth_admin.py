"""Compatibility aggregator for authentication routes."""
from fastapi import APIRouter
from config import API_PREFIX
from routers.auth import session, profile, admin_users, gdrive

router = APIRouter(prefix=API_PREFIX)
for module in (session, profile, admin_users, gdrive):
    router.include_router(module.router)
