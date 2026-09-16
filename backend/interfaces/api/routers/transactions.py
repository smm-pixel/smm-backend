"""Transactions API — auth required + CreateJournalUseCase."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from config import API_PREFIX, WRITE_LEVEL
from dependencies import get_current_user
from infrastructure.database.connection import get_db
from infrastructure.database.models import User
from application.transactions.create_journal_use_case import (
    CreateJournalUseCase,
    JournalValidationError,
)
from infrastructure.repositories.transaction_repository import TransactionRepository
from services.jwt_service import require_roles

router = APIRouter(prefix=API_PREFIX)


class JournalLineIn(BaseModel):
    account_code: str
    debit: Decimal = Field(default=Decimal("0"), ge=0)
    kredit: Decimal = Field(default=Decimal("0"), ge=0)
    description: str = ""


class JournalCreateIn(BaseModel):
    date: date
    keterangan: str
    unit_usaha_id: Optional[str] = None
    unit_group: str = "BUMDES"
    lines: list[JournalLineIn]
    nomor_bukti: str = ""
    transaction_type: str = ""
    mitra_id: Optional[str] = None


@router.get("/transactions")
async def list_transactions(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    unit_usaha_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "pengelola" and current_user.unit_usaha_id:
        unit_usaha_id = current_user.unit_usaha_id
    repo = TransactionRepository(session)
    rows = await repo.list_by_unit(
        unit_usaha_id,
        date_from=start_date,
        date_to=end_date,
        limit=limit,
        offset=offset,
    )
    return [
        {
            "id": t.id,
            "date": t.date.isoformat(),
            "keterangan": t.keterangan,
            "nomor_bukti": t.nomor_bukti,
            "unit_usaha_id": t.unit_usaha_id,
            "transaction_type": t.transaction_type,
            "lines": [
                {
                    "account_id": ln.account_id,
                    "debit": float(ln.debit),
                    "kredit": float(ln.kredit),
                    "description": ln.description,
                }
                for ln in t.lines
            ],
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in rows
    ]


@router.post("/transactions")
async def create_transaction(
    body: JournalCreateIn,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: dict = Depends(require_roles(*WRITE_LEVEL, "pengelola")),
):
    unit_id = body.unit_usaha_id
    if current_user.role == "pengelola":
        unit_id = current_user.unit_usaha_id
    uc = CreateJournalUseCase(session)
    try:
        trx = await uc.execute(
            trx_date=body.date,
            keterangan=body.keterangan,
            unit_usaha_id=unit_id,
            unit_group=body.unit_group,
            lines=[ln.model_dump() for ln in body.lines],
            nomor_bukti=body.nomor_bukti,
            transaction_type=body.transaction_type,
            mitra_id=body.mitra_id,
            created_by=current_user.id,
        )
    except JournalValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"id": trx.id, "date": trx.date.isoformat(), "keterangan": trx.keterangan}
