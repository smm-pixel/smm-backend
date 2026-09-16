"""Compatibility aggregator for modular routes."""
from fastapi import APIRouter, Depends
from dependencies import require_password_ready
from routers.reports import public_dashboard
from routers.reports import periods
from routers.reports import financial
from routers.reports import exports
from routers.reports import pdf

router = APIRouter()
# Public dashboard endpoints are intentionally accessible without password-change gating.
router.include_router(public_dashboard.router)
router.include_router(periods.router, dependencies=[Depends(require_password_ready)])
router.include_router(financial.router, dependencies=[Depends(require_password_ready)])
router.include_router(exports.router, dependencies=[Depends(require_password_ready)])
router.include_router(pdf.router, dependencies=[Depends(require_password_ready)])
