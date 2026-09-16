"""CRUD transaksi & journal lines — multi-tenant via unit_usaha_id."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from infrastructure.database.models import Transaction, TransactionLine


class TransactionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        trx_date: date,
        keterangan: str,
        unit_usaha_id: Optional[str],
        lines: list[dict],  # [{account_id, debit, kredit, description?}]
        nomor_bukti: str = "",
        transaction_type: str = "",
        mitra_id: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> Transaction:
        trx = Transaction(
            date=trx_date,
            keterangan=keterangan,
            unit_usaha_id=unit_usaha_id,
            nomor_bukti=nomor_bukti,
            transaction_type=transaction_type,
            mitra_id=mitra_id,
            created_by=created_by,
        )
        self.session.add(trx)
        await self.session.flush()
        for ln in lines:
            self.session.add(
                TransactionLine(
                    transaction_id=trx.id,
                    account_id=ln["account_id"],
                    debit=Decimal(str(ln.get("debit", 0))),
                    kredit=Decimal(str(ln.get("kredit", 0))),
                    description=ln.get("description", ""),
                )
            )
        await self.session.flush()
        return trx

    async def get_by_id(self, trx_id: str, unit_usaha_id: Optional[str] = None) -> Optional[Transaction]:
        stmt = (
            select(Transaction)
            .options(selectinload(Transaction.lines))
            .where(Transaction.id == trx_id)
        )
        if unit_usaha_id is not None:
            stmt = stmt.where(Transaction.unit_usaha_id == unit_usaha_id)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def list_by_unit(
        self,
        unit_usaha_id: Optional[str],
        *,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Transaction]:
        stmt = (
            select(Transaction)
            .options(selectinload(Transaction.lines))
            .order_by(Transaction.date.desc(), Transaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if unit_usaha_id is not None:
            stmt = stmt.where(Transaction.unit_usaha_id == unit_usaha_id)
        if date_from:
            stmt = stmt.where(Transaction.date >= date_from)
        if date_to:
            stmt = stmt.where(Transaction.date <= date_to)
        return (await self.session.execute(stmt)).scalars().all()
