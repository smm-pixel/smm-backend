"""Transactions API — delegates to CreateJournalUseCase / TransactionRepository.
Paths: /api/transactions (GET, POST) — unchanged for frontend.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from config import API_PREFIX, WRITE_LEVEL
from infrastructure.database.connection import get_db
from application.transactions.create_journal_use_case import (
    CreateJournalUseCase,
    JournalValidationError,
)
from infrastructure.repositories.transaction_repository import TransactionRepository

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
    unit_group: str = "BUMDES"  # BUMDES | UU01..UU06
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
):
    repo = TransactionRepository(session)
    rows = await repo.list_by_unit(
        unit_usaha_id,
        date_from=start_date,
        date_to=end_date,
        limit=limit,
        offset=offset,
    )
    result = []
    for t in rows:
        result.append(
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
        )
    return result


@router.post("/transactions")
async def create_transaction(
    body: JournalCreateIn,
    session: AsyncSession = Depends(get_db),
):
    uc = CreateJournalUseCase(session)
    try:
        trx = await uc.execute(
            trx_date=body.date,
            keterangan=body.keterangan,
            unit_usaha_id=body.unit_usaha_id,
            unit_group=body.unit_group,
            lines=[ln.model_dump() for ln in body.lines],
            nomor_bukti=body.nomor_bukti,
            transaction_type=body.transaction_type,
            mitra_id=body.mitra_id,
        )
    except JournalValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"id": trx.id, "date": trx.date.isoformat(), "keterangan": trx.keterangan}
