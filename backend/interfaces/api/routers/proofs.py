"""Upload bukti transaksi → Google Drive (OAuth admin token) + tabel bukti_transaksi.
Path: POST /api/transactions/{tx_id}/proof — unchanged.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import API_PREFIX
from infrastructure.database.connection import get_db
from infrastructure.database.models import BuktiTransaksi, Transaction
from services import gdrive_service

router = APIRouter(prefix=API_PREFIX)

# Token OAuth admin disimpan di env / tabel legacy oauth_tokens via gdrive_service.
# Upload memakai refresh_token terpusat — bendahara tidak perlu login Google ulang.


async def _get_refresh_token(session: AsyncSession) -> str:
    """Ambil refresh_token admin. Fallback ke env GDRIVE_REFRESH_TOKEN."""
    import os

    env_tok = os.getenv("GDRIVE_REFRESH_TOKEN")
    if env_tok:
        return env_tok
    # Legacy document store (selama migrasi belum selesai penuh)
    try:
        from database import db  # type: ignore

        tok = await db.oauth_tokens.select_one({"provider": "gdrive"}, {"_id": 0})
        if tok and tok.get("refresh_token"):
            return tok["refresh_token"]
    except Exception:
        pass
    raise HTTPException(
        status_code=503,
        detail="Google Drive belum terhubung. Admin perlu Hubungkan Drive terlebih dahulu.",
    )


@router.post("/transactions/{tx_id}/proof")
async def upload_proof(
    tx_id: str,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
):
    trx = await session.get(Transaction, tx_id)
    if not trx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")

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

    refresh_token = await _get_refresh_token(session)
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
