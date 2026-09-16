"""Compatibility aggregator for modular routes."""
from fastapi import APIRouter, Depends
from dependencies import require_password_ready
from routers.transactions import crud
from routers.transactions import imports
from routers.transactions import proofs
from routers.transactions import ledger
from routers.transactions import exports

router = APIRouter()
router.include_router(crud.router, dependencies=[Depends(require_password_ready)])
router.include_router(imports.router, dependencies=[Depends(require_password_ready)])
router.include_router(proofs.router, dependencies=[Depends(require_password_ready)])
router.include_router(ledger.router, dependencies=[Depends(require_password_ready)])
router.include_router(exports.router, dependencies=[Depends(require_password_ready)])
