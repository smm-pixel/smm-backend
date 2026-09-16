"""Endpoint inventory Unit Toko Offline (UU05).

Router ini menggunakan Async SQLAlchemy dan transaksi database atomik. Data
keuangan mingguan ditulis ke application_entities dengan bentuk yang sama
seperti koleksi transactions lama, sehingga tidak mengubah tabel keuangan inti.
"""
from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from database import SessionLocal, db
from models import Produk, StokKeluar, StokMasuk
from services.jwt_service import get_current_user_payload
from dependencies import user_from_payload

router = APIRouter(prefix="/api/stok", tags=["Stok"])
UNIT_ID = "UU05"
ALLOWED_ROLES = {"admin", "direktur", "bendahara"}


async def require_stok_access(payload: dict = Depends(get_current_user_payload)) -> dict:
    """Require an active session and restrict pengelola to the UU05 unit.

    Existing users may store either the unit code (UU05) or the generated
    document id in ``unit_usaha_id``. Resolve both representations against
    the canonical unit collection instead of weakening access to any unit.
    """
    user = await user_from_payload(payload)
    has_uu05_access = False
    if user.role == "pengelola" and user.unit_usaha_id:
        assigned_unit = str(user.unit_usaha_id).upper()
        has_uu05_access = assigned_unit == UNIT_ID
        if not has_uu05_access:
            unit = await db.unit_usaha.select_one({"id": user.unit_usaha_id}, {"_id": 0})
            has_uu05_access = bool(unit and str(unit.get("code", "")).upper() == UNIT_ID)
    if user.role not in ALLOWED_ROLES and not has_uu05_access:
        raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke modul stok UU05")
    if user.must_change_password:
        raise HTTPException(status_code=403, detail="PASSWORD_CHANGE_REQUIRED")
    return payload


class ProdukInput(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    nama_produk: str = Field(min_length=1, max_length=255)
    kategori: str = Field(min_length=1, max_length=100)
    satuan: str = Field(min_length=1, max_length=20)
    harga_beli: int = Field(ge=0)
    harga_jual: int = Field(ge=0)


class StokMasukInput(BaseModel):
    produk_id: int = Field(gt=0)
    tanggal: date = Field(default_factory=date.today)
    jumlah: int = Field(gt=0)
    harga_beli_satuan: int = Field(ge=0)


class StokKeluarInput(BaseModel):
    produk_id: int = Field(gt=0)
    tanggal: date = Field(default_factory=date.today)
    jumlah: int = Field(gt=0)
    tipe_keluar: Literal["penjualan", "rusak", "kadaluarsa"]
    keterangan: str | None = Field(default=None, max_length=500)


def produk_response(item: Produk) -> dict:
    return {
        "id": item.id,
        "sku": item.sku,
        "nama_produk": item.nama_produk,
        "kategori": item.kategori,
        "stok_saat_ini": item.stok_saat_ini,
        "satuan": item.satuan,
        "harga_beli": item.harga_beli,
        "harga_jual": item.harga_jual,
        "unit_id": item.unit_id,
    }


@router.post("/produk", status_code=status.HTTP_201_CREATED)
async def buat_produk(data: ProdukInput, _: dict = Depends(require_stok_access)):
    async with SessionLocal() as session:
        exists = await session.scalar(select(Produk).where(Produk.sku == data.sku, Produk.unit_id == UNIT_ID))
        if exists:
            raise HTTPException(status_code=409, detail="SKU sudah digunakan pada unit UU05")
        item = Produk(**data.model_dump(), unit_id=UNIT_ID)
        session.add(item)
        await session.commit()
        await session.refresh(item)
        return produk_response(item)


@router.get("/produk")
async def daftar_produk(_: dict = Depends(require_stok_access)):
    async with SessionLocal() as session:
        result = await session.scalars(select(Produk).where(Produk.unit_id == UNIT_ID).order_by(Produk.nama_produk))
        return [produk_response(item) for item in result.all()]


@router.post("/masuk", status_code=status.HTTP_201_CREATED)
async def catat_stok_masuk(data: StokMasukInput, _: dict = Depends(require_stok_access)):
    async with SessionLocal() as session:
        async with session.begin():
            product = await session.scalar(select(Produk).where(Produk.id == data.produk_id, Produk.unit_id == UNIT_ID).with_for_update())
            if not product:
                raise HTTPException(status_code=404, detail="Produk UU05 tidak ditemukan")
            total = data.jumlah * data.harga_beli_satuan
            item = StokMasuk(
                tanggal=datetime.combine(data.tanggal, time.min, tzinfo=timezone.utc),
                produk_id=product.id,
                jumlah=data.jumlah,
                harga_beli_satuan=data.harga_beli_satuan,
                total_biaya=total,
                status_keuangan="belum_sinkron",
                unit_id=UNIT_ID,
            )
            product.stok_saat_ini += data.jumlah
            session.add(item)
        await session.refresh(item)
        return {"pesan": "Stok masuk berhasil dicatat", "id": item.id, "total_biaya": total, "status_keuangan": item.status_keuangan}


@router.post("/keluar", status_code=status.HTTP_201_CREATED)
async def catat_stok_keluar(data: StokKeluarInput, _: dict = Depends(require_stok_access)):
    async with SessionLocal() as session:
        async with session.begin():
            product = await session.scalar(select(Produk).where(Produk.id == data.produk_id, Produk.unit_id == UNIT_ID).with_for_update())
            if not product:
                raise HTTPException(status_code=404, detail="Produk UU05 tidak ditemukan")
            if product.stok_saat_ini < data.jumlah:
                raise HTTPException(status_code=422, detail="Stok tidak mencukupi")
            item = StokKeluar(
                tanggal=datetime.combine(data.tanggal, time.min, tzinfo=timezone.utc),
                produk_id=product.id,
                unit_id=UNIT_ID,
                jumlah=data.jumlah,
                tipe_keluar=data.tipe_keluar,
                keterangan=data.keterangan,
            )
            product.stok_saat_ini -= data.jumlah
            session.add(item)
        await session.refresh(item)
        return {"pesan": "Stok keluar berhasil dicatat", "id": item.id, "stok_saat_ini": product.stok_saat_ini}


@router.get("/mutasi")
async def daftar_mutasi(_: dict = Depends(require_stok_access)):
    async with SessionLocal() as session:
        masuk = (await session.execute(
            select(StokMasuk, Produk.nama_produk)
            .join(Produk, Produk.id == StokMasuk.produk_id)
            .where(StokMasuk.unit_id == UNIT_ID)
            .order_by(StokMasuk.tanggal.desc())
        )).all()
        keluar = (await session.execute(
            select(StokKeluar, Produk.nama_produk)
            .join(Produk, Produk.id == StokKeluar.produk_id)
            .where(StokKeluar.unit_id == UNIT_ID)
            .order_by(StokKeluar.tanggal.desc())
        )).all()
        rows = [
            {"id": item.id, "tanggal": item.tanggal, "nama_produk": nama, "jenis": "in", "jumlah": item.jumlah, "total_biaya": item.total_biaya, "status_keuangan": item.status_keuangan}
            for item, nama in masuk
        ] + [
            {"id": item.id, "tanggal": item.tanggal, "nama_produk": nama, "jenis": "out", "jumlah": item.jumlah, "total_biaya": 0, "status_keuangan": "terbuku"}
            for item, nama in keluar
        ]
        return sorted(rows, key=lambda row: row["tanggal"], reverse=True)


@router.get("/masuk/ringkasan-mingguan")
async def ringkasan_mingguan(_: dict = Depends(require_stok_access)):
    async with SessionLocal() as session:
        items = (await session.scalars(select(StokMasuk).where(StokMasuk.status_keuangan == "belum_sinkron", StokMasuk.unit_id == UNIT_ID))).all()
        return {"total_biaya": sum(item.total_biaya for item in items), "jumlah_item": len(items), "status_keuangan": "belum_sinkron" if items else "terkirim"}


@router.post("/mutasi")
async def catat_mutasi(data: dict, _: dict = Depends(require_stok_access)):
    jenis = data.get("jenis")
    if jenis == "in":
        return await catat_stok_masuk(StokMasukInput(produk_id=int(data["produk_id"]), tanggal=date.fromisoformat(data["tanggal"]) if data.get("tanggal") else date.today(), jumlah=int(data["jumlah"]), harga_beli_satuan=int(data.get("harga_satuan", 0))))
    if jenis == "out":
        return await catat_stok_keluar(StokKeluarInput(produk_id=int(data["produk_id"]), tanggal=date.fromisoformat(data["tanggal"]) if data.get("tanggal") else date.today(), jumlah=int(data["jumlah"]), tipe_keluar="penjualan", keterangan=data.get("keterangan")))
    raise HTTPException(status_code=422, detail="Jenis mutasi harus in atau out")


@router.post("/masuk/sinkronisasi-mingguan")
async def sinkronisasi_mingguan(_: dict = Depends(require_stok_access)):
    expected_transaction_code = "sinkronisasi_stok"
    expected_transaction_name = "2. Pembelian Barang Dagangan (Sinkronisasi Aplikasi)"

    async with SessionLocal() as session:
        async with session.begin():
            items = list((await session.scalars(select(StokMasuk).where(StokMasuk.status_keuangan == "belum_sinkron", StokMasuk.unit_id == UNIT_ID).with_for_update())).all())
            total = sum(abs(item.total_biaya) for item in items)
            if not items:
                return {"pesan": "Tidak ada stok masuk yang perlu disinkronkan", "jumlah_item": 0, "total_biaya": 0}

            transaction_types = await db.transaction_types.select({}, {"_id": 0}).all(1000)
            transaction_type = next(
                (
                    row for row in transaction_types
                    if str(row.get("code", "")).strip() == expected_transaction_code
                    and str(row.get("name", "")).strip() == expected_transaction_name
                    and (
                        str(row.get("group", "")).strip().upper() == UNIT_ID
                        or UNIT_ID in {str(code).strip().upper() for code in (row.get("unit_codes") or [])}
                    )
                ),
                None,
            )
            if not transaction_type:
                raise HTTPException(status_code=409, detail=f"Jenis transaksi UU05 wajib belum tersedia atau belum ditautkan ke UU05. Tambahkan kode {expected_transaction_code}: {expected_transaction_name}")

            expected_debit = str(transaction_type.get("debit", "")).strip()
            expected_credit = str(transaction_type.get("credit", "")).strip()
            if not expected_debit or not expected_credit:
                raise HTTPException(status_code=409, detail="Jenis transaksi sinkronisasi_stok belum memiliki akun debit dan kredit")

            accounts = await db.accounts.select({"group": UNIT_ID}, {"_id": 0}).all(1000)
            account_by_code = {str(row.get("code", "")).strip(): row for row in accounts}
            debit_account = account_by_code.get(expected_debit)
            credit_account = account_by_code.get(expected_credit)
            if not debit_account:
                raise HTTPException(status_code=409, detail=f"Kode akun debit {expected_debit} dari master UU05 tidak ditemukan")
            if not credit_account:
                raise HTTPException(status_code=409, detail=f"Kode akun kredit {expected_credit} dari master UU05 tidak ditemukan")

            unit_doc = await db.unit_usaha.select_one({"code": UNIT_ID}, {"_id": 0})
            if not unit_doc or not unit_doc.get("id"):
                raise HTTPException(status_code=409, detail="Unit UU05 belum terdaftar pada master unit usaha")

            created_count = 0
            for item in items:
                reference = f"sinkronisasi-stok:{item.id}"
                existing = await db.transactions.select_one({"reference": reference}, {"_id": 0})
                if not existing:
                    await db.transactions.create({
                        "id": str(uuid4()),
                        "date": item.tanggal.date().isoformat(),
                        "unit_usaha_id": unit_doc["id"],
                        "transaction_type": expected_transaction_code,
                        "description": expected_transaction_name,
                        "amount": abs(item.total_biaya),
                        "debit_account_code": expected_debit,
                        "credit_account_code": expected_credit,
                        "reference": reference,
                    })
                    created_count += 1
                item.status_keuangan = "terkirim"
            return {"pesan": "Stok masuk berhasil terbuku di keuangan", "jumlah_item": len(items), "transaksi_baru": created_count, "total_biaya": total, "status_keuangan": "terkirim"}
