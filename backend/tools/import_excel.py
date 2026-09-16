"""Import backup transaksi dari Excel ke tabel relasional baru.

Usage (dari folder backend/):
    python -m tools.import_excel

Asumsi file: data/backup_transaksi.xlsx
Kolom minimal: Tanggal, Keterangan, Kode_Akun, Debit, Kredit, Unit_Usaha_ID
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Pastikan backend/ ada di path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from infrastructure.database.connection import SessionLocal, init_db
from infrastructure.database.models import Account, Transaction, TransactionLine, UnitUsaha

EXCEL_PATH = ROOT.parent / "data" / "backup_transaksi.xlsx"


def _dec(val) -> Decimal:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return Decimal("0.00")
    try:
        return Decimal(str(val).replace(",", "")).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return Decimal("0.00")


def _parse_date(val):
    if pd.isna(val):
        raise ValueError("Tanggal kosong")
    if isinstance(val, datetime):
        return val.date()
    return pd.to_datetime(val).date()


async def _load_lookups(session: AsyncSession) -> tuple[dict[str, str], dict[str, str]]:
    """Return maps: unit_code -> unit.id, account_code+group -> account.id"""
    units = {u.code: u.id for u in (await session.execute(select(UnitUsaha))).scalars()}
    accounts = {}
    for a in (await session.execute(select(Account))).scalars():
        accounts[(a.code, a.group)] = a.id
        accounts[a.code] = a.id  # fallback tanpa group
    return units, accounts


async def import_excel(path: Path = EXCEL_PATH) -> None:
    if not path.exists():
        print(f"[ERROR] File tidak ditemukan: {path}")
        sys.exit(1)

    df = pd.read_excel(path, engine="openpyxl")
    required = {"Tanggal", "Keterangan", "Kode_Akun", "Debit", "Kredit", "Unit_Usaha_ID"}
    missing = required - set(df.columns)
    if missing:
        print(f"[ERROR] Kolom hilang di Excel: {missing}")
        sys.exit(1)

    await init_db()
    async with SessionLocal() as session:
        units, accounts = await _load_lookups(session)
        if not units:
            print("[ERROR] Tabel unit_usaha kosong. Seed dulu sebelum impor.")
            sys.exit(1)
        if not accounts:
            print("[ERROR] Tabel accounts kosong. Seed COA dulu sebelum impor.")
            sys.exit(1)

        # Group baris yang punya keterangan+tanggal+unit sama menjadi 1 header
        # (satu transaksi double-entry bisa punya beberapa baris akun)
        groups: dict[tuple, list] = {}
        errors: list[str] = []

        for idx, row in df.iterrows():
            row_num = idx + 2  # Excel 1-indexed + header
            try:
                tgl = _parse_date(row["Tanggal"])
                ket = str(row["Keterangan"]).strip()
                kode = str(row["Kode_Akun"]).strip()
                unit_code = str(row["Unit_Usaha_ID"]).strip()
                debit = _dec(row["Debit"])
                kredit = _dec(row["Kredit"])

                if unit_code not in units:
                    errors.append(f"Baris {row_num}: Unit_Usaha_ID '{unit_code}' tidak ada di unit_usaha")
                    continue
                if kode not in accounts and (kode, unit_code) not in accounts:
                    errors.append(f"Baris {row_num}: Kode_Akun '{kode}' tidak ada di accounts")
                    continue
                if debit == 0 and kredit == 0:
                    errors.append(f"Baris {row_num}: Debit dan Kredit keduanya 0")
                    continue
                if debit > 0 and kredit > 0:
                    errors.append(f"Baris {row_num}: Debit dan Kredit tidak boleh keduanya > 0")
                    continue

                key = (tgl, ket, unit_code)
                groups.setdefault(key, []).append(
                    {
                        "kode": kode,
                        "unit_code": unit_code,
                        "debit": debit,
                        "kredit": kredit,
                    }
                )
            except Exception as exc:
                errors.append(f"Baris {row_num}: {exc}")

        if errors:
            print("[VALIDASI GAGAL] Perbaiki data Excel dulu:")
            for e in errors[:30]:
                print(f"  - {e}")
            if len(errors) > 30:
                print(f"  ... dan {len(errors) - 30} error lainnya")
            sys.exit(1)

        created = 0
        for (tgl, ket, unit_code), lines in groups.items():
            total_d = sum(l["debit"] for l in lines)
            total_k = sum(l["kredit"] for l in lines)
            if total_d != total_k:
                print(f"[SKIP] Jurnal tidak seimbang ({tgl} | {ket}): D={total_d} K={total_k}")
                continue

            unit_id = units[unit_code]
            trx = Transaction(
                date=tgl,
                keterangan=ket,
                unit_usaha_id=unit_id,
                nomor_bukti="",
                transaction_type="import_excel",
            )
            session.add(trx)
            await session.flush()  # dapatkan trx.id

            for ln in lines:
                acc_id = accounts.get((ln["kode"], unit_code)) or accounts[ln["kode"]]
                session.add(
                    TransactionLine(
                        transaction_id=trx.id,
                        account_id=acc_id,
                        debit=ln["debit"],
                        kredit=ln["kredit"],
                    )
                )
            created += 1

        await session.commit()
        print(f"[OK] Impor selesai. {created} transaksi (header) dimasukkan ke database.")


if __name__ == "__main__":
    asyncio.run(import_excel())
