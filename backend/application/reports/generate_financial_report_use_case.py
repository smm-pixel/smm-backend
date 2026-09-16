"""Use-case: Buku Besar, Neraca, Laba Rugi — terisolasi per tenant/group."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from infrastructure.database.models import Account, Transaction, TransactionLine
from infrastructure.repositories.account_repository import AccountRepository


class GenerateFinancialReportUseCase:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.acc_repo = AccountRepository(session)

    async def _lines_in_period(
        self,
        unit_usaha_id: Optional[str],
        group: Optional[str],
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> list[tuple[TransactionLine, Account, Transaction]]:
        stmt = (
            select(TransactionLine, Account, Transaction)
            .join(Account, TransactionLine.account_id == Account.id)
            .join(Transaction, TransactionLine.transaction_id == Transaction.id)
        )
        if unit_usaha_id is not None:
            stmt = stmt.where(Transaction.unit_usaha_id == unit_usaha_id)
        if group:
            stmt = stmt.where(Account.group == group)
        if date_from:
            stmt = stmt.where(Transaction.date >= date_from)
        if date_to:
            stmt = stmt.where(Transaction.date <= date_to)
        rows = (await self.session.execute(stmt)).all()
        return list(rows)

    def _signed_amount(self, acc: Account, debit: Decimal, kredit: Decimal) -> Decimal:
        """Saldo sesuai normal_balance COA (Kepmendesa 136/2022)."""
        if acc.normal_balance == "debit":
            return debit - kredit
        return kredit - debit

    async def buku_besar(
        self,
        *,
        unit_usaha_id: Optional[str] = None,
        group: Optional[str] = None,
        account_code: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> list[dict]:
        rows = await self._lines_in_period(unit_usaha_id, group, date_from, date_to)
        ledger: dict[str, dict] = {}
        for line, acc, trx in rows:
            if account_code and acc.code != account_code:
                continue
            entry = ledger.setdefault(
                acc.code,
                {
                    "account_code": acc.code,
                    "account_name": acc.name,
                    "category": acc.category,
                    "normal_balance": acc.normal_balance,
                    "mutasi": [],
                    "saldo": Decimal("0.00"),
                },
            )
            signed = self._signed_amount(acc, line.debit, line.kredit)
            entry["saldo"] += signed
            entry["mutasi"].append(
                {
                    "date": trx.date.isoformat(),
                    "keterangan": trx.keterangan,
                    "debit": float(line.debit),
                    "kredit": float(line.kredit),
                    "saldo_berjalan": float(entry["saldo"]),
                }
            )
        for v in ledger.values():
            v["saldo"] = float(v["saldo"])
        return list(ledger.values())

    async def neraca(
        self,
        *,
        unit_usaha_id: Optional[str] = None,
        group: Optional[str] = None,
        as_of: Optional[date] = None,
    ) -> dict:
        rows = await self._lines_in_period(unit_usaha_id, group, None, as_of)
        buckets = {"aset": [], "kewajiban": [], "ekuitas": []}
        totals = {"aset": Decimal("0"), "kewajiban": Decimal("0"), "ekuitas": Decimal("0")}
        saldo_map: dict[str, dict] = {}

        for line, acc, _ in rows:
            if acc.category not in buckets:
                continue
            item = saldo_map.setdefault(
                acc.code,
                {"code": acc.code, "name": acc.name, "saldo": Decimal("0")},
            )
            item["saldo"] += self._signed_amount(acc, line.debit, line.kredit)

        for code, item in saldo_map.items():
            # lookup category from last known account in rows
            cat = next(a.category for _, a, _ in rows if a.code == code)
            if cat in buckets:
                buckets[cat].append({**item, "saldo": float(item["saldo"])})
                totals[cat] += item["saldo"]

        return {
            "aset": buckets["aset"],
            "kewajiban": buckets["kewajiban"],
            "ekuitas": buckets["ekuitas"],
            "total_aset": float(totals["aset"]),
            "total_kewajiban": float(totals["kewajiban"]),
            "total_ekuitas": float(totals["ekuitas"]),
        }

    async def laba_rugi(
        self,
        *,
        unit_usaha_id: Optional[str] = None,
        group: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> dict:
        rows = await self._lines_in_period(unit_usaha_id, group, date_from, date_to)
        pendapatan: list[dict] = []
        beban: list[dict] = []
        total_p = Decimal("0")
        total_b = Decimal("0")
        saldo_map: dict[str, dict] = {}

        for line, acc, _ in rows:
            if acc.category not in ("pendapatan", "beban"):
                continue
            item = saldo_map.setdefault(
                acc.code,
                {"code": acc.code, "name": acc.name, "category": acc.category, "saldo": Decimal("0")},
            )
            item["saldo"] += self._signed_amount(acc, line.debit, line.kredit)

        for item in saldo_map.values():
            row = {**item, "saldo": float(item["saldo"])}
            if item["category"] == "pendapatan":
                pendapatan.append(row)
                total_p += item["saldo"]
            else:
                beban.append(row)
                total_b += item["saldo"]

        return {
            "pendapatan": pendapatan,
            "beban": beban,
            "total_pendapatan": float(total_p),
            "total_beban": float(total_b),
            "laba_rugi_bersih": float(total_p - total_b),
        }
