"""Compatibility aggregator for modular routes."""
from fastapi import APIRouter, Depends
from dependencies import require_password_ready
from routers.master_data import units_partners
from routers.master_data import accounts
from routers.master_data import transaction_types
from routers.master_data import revenue_share

router = APIRouter()
router.include_router(units_partners.router, dependencies=[Depends(require_password_ready)])
router.include_router(accounts.router, dependencies=[Depends(require_password_ready)])
router.include_router(transaction_types.router, dependencies=[Depends(require_password_ready)])
router.include_router(revenue_share.router, dependencies=[Depends(require_password_ready)])
