"""Upload bukti — auth required, GDrive OAuth admin token, tabel bukti_transaksi."""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import API_PREFIX
from dependencies import get_current_user
from infrastructure.database.connection import get_db
from infrastructure.database.models import BuktiTransaksi, Transaction, User
from services import gdrive_service
from services.jwt_service import require_roles

router = APIRouter(prefix=API_PREFIX)


async def _get_refresh_token() -> str:
    env_tok = os.getenv("GDRIVE_REFRESH_TOKEN")
    if env_tok:
        return env_tok
    raise HTTPException(
        status_code=503,
        detail="Google Drive belum terhubung. Set GDRIVE_REFRESH_TOKEN atau Hubungkan Drive.",
    )


@router.post("/transactions/{tx_id}/proof")
async def upload_proof(
    tx_id: str,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: dict = Depends(require_roles("admin", "direktur", "bendahara", "pengelola")),
):
    trx = await session.get(Transaction, tx_id)
    if not trx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    if current_user.role == "pengelola" and trx.unit_usaha_id != current_user.unit_usaha_id:
        raise HTTPException(status_code=403, detail="Bukan transaksi unit Anda")

    existing = (
        await session.execute(
            select(BuktiTransaksi).where(BuktiTransaksi.transaction_id == tx_id)
        )
    ).scalars().all()
    if len(existing) >= 3:
        raise HTTPException(status_code=400, detail="Maksimal 3 file bukti per transaksi")

    fname = (file.filename or "").lower()
    ext = fname.rsplit(".", 1)[-1] if "." in fname else ""
    if ext not in ("pdf", "jpg", "jpeg", "png"):
        raise HTTPException(status_code=400, detail="Format harus PDF/JPG/JPEG/PNG")

    data = await file.read()
    if len(data) > 1 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 1 MB")

    refresh_token = await _get_refresh_token()
    ddmmyyyy = trx.date.strftime("%d%m%Y")
    new_name = f"BUKTI_{ddmmyyyy}_{len(existing) + 1}.{ext}"
    meta = gdrive_service.upload_bytes(refresh_token, data, new_name)

    bukti = BuktiTransaksi(
        transaction_id=tx_id,
        gdrive_file_id=meta["id"],
        gdrive_url=meta.get("webViewLink") or "",
        file_name=meta.get("name") or new_name,
    )
    session.add(bukti)
    await session.flush()

    all_bukti = (
        await session.execute(
            select(BuktiTransaksi).where(BuktiTransaksi.transaction_id == tx_id)
        )
    ).scalars().all()
    return {
        "ok": True,
        "proofs": [
            {
                "id": b.id,
                "file_id": b.gdrive_file_id,
                "url": b.gdrive_url,
                "file_name": b.file_name,
            }
            for b in all_bukti
        ],
    }
