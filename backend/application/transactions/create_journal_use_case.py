"""Use-case: buat jurnal double-entry + audit log."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from application.services.audit_log_service import AuditLogService
from infrastructure.repositories.account_repository import AccountRepository
from infrastructure.repositories.transaction_repository import TransactionRepository


class JournalValidationError(Exception):
    pass


class CreateJournalUseCase:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.trx_repo = TransactionRepository(session)
        self.acc_repo = AccountRepository(session)
        self.audit = AuditLogService(session)

    async def execute(
        self,
        *,
        trx_date: date,
        keterangan: str,
        unit_usaha_id: Optional[str],
        unit_group: str,
        lines: list[dict],
        nomor_bukti: str = "",
        transaction_type: str = "",
        mitra_id: Optional[str] = None,
        created_by: Optional[str] = None,
        ip_address: Optional[str] = None,
    ):
        if not lines or len(lines) < 2:
            raise JournalValidationError("Jurnal minimal 2 baris (debit & kredit)")

        total_d = Decimal("0")
        total_k = Decimal("0")
        codes = []
        for ln in lines:
            d = Decimal(str(ln.get("debit", 0)))
            k = Decimal(str(ln.get("kredit", 0)))
            if d < 0 or k < 0:
                raise JournalValidationError("Debit/Kredit tidak boleh negatif")
            if (d > 0 and k > 0) or (d == 0 and k == 0):
                raise JournalValidationError(
                    f"Baris akun {ln.get('account_code')}: harus debit XOR kredit"
                )
            total_d += d
            total_k += k
            codes.append(ln["account_code"])

        if total_d != total_k:
            raise JournalValidationError(
                f"Jurnal tidak seimbang: Debit={total_d} Kredit={total_k}"
            )
        if total_d == 0:
            raise JournalValidationError("Total nominal tidak boleh 0")

        acc_map = await self.acc_repo.map_by_codes(codes, group=unit_group)
        resolved = []
        for ln in lines:
            code = ln["account_code"]
            acc = acc_map.get(code)
            if not acc:
                raise JournalValidationError(
                    f"Akun '{code}' tidak ditemukan atau bukan milik group '{unit_group}'"
                )
            if acc.unit_usaha_id and unit_usaha_id and acc.unit_usaha_id != unit_usaha_id:
                raise JournalValidationError(
                    f"Akun '{code}' tidak boleh dipakai unit usaha lain"
                )
            resolved.append(
                {
                    "account_id": acc.id,
                    "debit": Decimal(str(ln.get("debit", 0))),
                    "kredit": Decimal(str(ln.get("kredit", 0))),
                    "description": ln.get("description", ""),
                }
            )

        trx = await self.trx_repo.create(
            trx_date=trx_date,
            keterangan=keterangan,
            unit_usaha_id=unit_usaha_id,
            lines=resolved,
            nomor_bukti=nomor_bukti,
            transaction_type=transaction_type,
            mitra_id=mitra_id,
            created_by=created_by,
        )

        await self.audit.record(
            action="journal.create",
            user_id=created_by,
            ip_address=ip_address,
            payload_before=None,
            payload_after={
                "transaction_id": trx.id,
                "date": str(trx_date),
                "keterangan": keterangan,
                "unit_usaha_id": unit_usaha_id,
                "unit_group": unit_group,
                "total": str(total_d),
                "lines": lines,
            },
        )
        return trx
