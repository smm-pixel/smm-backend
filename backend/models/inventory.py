"""Inventory domain models for the BUMDes stock-management feature."""

from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp for inventory events."""
    return datetime.now(timezone.utc)


class Produk(Base):
    __tablename__ = "produk"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    nama_produk: Mapped[str] = mapped_column(String(255), nullable=False)
    kategori: Mapped[str] = mapped_column(String(100), nullable=False)
    stok_saat_ini: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    satuan: Mapped[str] = mapped_column(String(20), nullable=False)
    harga_beli: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    harga_jual: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    unit_id: Mapped[str] = mapped_column(String(50), nullable=False, default="UU05", index=True)


class StokMasuk(Base):
    __tablename__ = "stok_masuk"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tanggal: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    produk_id: Mapped[int] = mapped_column(ForeignKey("produk.id"), nullable=False, index=True)
    jumlah: Mapped[int] = mapped_column(Integer, nullable=False)
    harga_beli_satuan: Mapped[int] = mapped_column(BigInteger, nullable=False)
    total_biaya: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status_keuangan: Mapped[str] = mapped_column(
        String(30), nullable=False, default="belum_sinkron"
    )
    unit_id: Mapped[str] = mapped_column(String(50), nullable=False, default="UU05", index=True)


class StokKeluar(Base):
    __tablename__ = "stok_keluar"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tanggal: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    produk_id: Mapped[int] = mapped_column(ForeignKey("produk.id"), nullable=False, index=True)
    jumlah: Mapped[int] = mapped_column(Integer, nullable=False)
    tipe_keluar: Mapped[str] = mapped_column(String(30), nullable=False)
    keterangan: Mapped[str | None] = mapped_column(String(500), nullable=True)
    unit_id: Mapped[str] = mapped_column(String(50), nullable=False, default="UU05", index=True)


# Alembic migration draft. Copy this block into a new revision under
# backend/alembic/versions/ after setting the correct revision identifiers.
# It only creates the three inventory tables and does not alter financial tables.
#
# from alembic import op
# import sqlalchemy as sa
#
# revision = "20260915_04_inventory_tables"
# down_revision = "20260913_03_remove_legacy_migration_table"
# branch_labels = None
# depends_on = None
#
#
# def upgrade() -> None:
#     op.create_table(
#         "produk",
#         sa.Column("id", sa.Integer(), nullable=False),
#         sa.Column("sku", sa.String(length=100), nullable=False),
#         sa.Column("nama_produk", sa.String(length=255), nullable=False),
#         sa.Column("kategori", sa.String(length=100), nullable=False),
#         sa.Column("stok_saat_ini", sa.Integer(), nullable=False, server_default="0"),
#         sa.Column("satuan", sa.String(length=20), nullable=False),
#         sa.Column("harga_beli", sa.BigInteger(), nullable=False, server_default="0"),
#         sa.Column("harga_jual", sa.BigInteger(), nullable=False, server_default="0"),
#         sa.Column("unit_id", sa.String(length=50), nullable=False, server_default="UU05"),
#         sa.PrimaryKeyConstraint("id"),
#         sa.UniqueConstraint("sku"),
#     )
#     op.create_index("ix_produk_sku", "produk", ["sku"], unique=False)
#     op.create_index("ix_produk_unit_id", "produk", ["unit_id"], unique=False)
#
#     op.create_table(
#         "stok_masuk",
#         sa.Column("id", sa.Integer(), nullable=False),
#         sa.Column("tanggal", sa.DateTime(timezone=True), nullable=False),
#         sa.Column("produk_id", sa.Integer(), nullable=False),
#         sa.Column("jumlah", sa.Integer(), nullable=False),
#         sa.Column("harga_beli_satuan", sa.BigInteger(), nullable=False),
#         sa.Column("total_biaya", sa.BigInteger(), nullable=False),
#         sa.Column("status_keuangan", sa.String(length=30), nullable=False, server_default="belum_sinkron"),
#         sa.Column("unit_id", sa.String(length=50), nullable=False, server_default="UU05"),
#         sa.ForeignKeyConstraint(["produk_id"], ["produk.id"]),
#         sa.PrimaryKeyConstraint("id"),
#     )
#     op.create_index("ix_stok_masuk_produk_id", "stok_masuk", ["produk_id"], unique=False)
#     op.create_index("ix_stok_masuk_unit_id", "stok_masuk", ["unit_id"], unique=False)
#
#     op.create_table(
#         "stok_keluar",
#         sa.Column("id", sa.Integer(), nullable=False),
#         sa.Column("tanggal", sa.DateTime(timezone=True), nullable=False),
#         sa.Column("produk_id", sa.Integer(), nullable=False),
#         sa.Column("jumlah", sa.Integer(), nullable=False),
#         sa.Column("tipe_keluar", sa.String(length=30), nullable=False),
#         sa.Column("keterangan", sa.String(length=500), nullable=True),
#         sa.Column("unit_id", sa.String(length=50), nullable=False, server_default="UU05"),
#         sa.ForeignKeyConstraint(["produk_id"], ["produk.id"]),
#         sa.PrimaryKeyConstraint("id"),
#     )
#     op.create_index("ix_stok_keluar_produk_id", "stok_keluar", ["produk_id"], unique=False)
#     op.create_index("ix_stok_keluar_unit_id", "stok_keluar", ["unit_id"], unique=False)
#
#
# def downgrade() -> None:
#     op.drop_index("ix_stok_keluar_unit_id", table_name="stok_keluar")
#     op.drop_index("ix_stok_keluar_produk_id", table_name="stok_keluar")
#     op.drop_table("stok_keluar")
#     op.drop_index("ix_stok_masuk_unit_id", table_name="stok_masuk")
#     op.drop_index("ix_stok_masuk_produk_id", table_name="stok_masuk")
#     op.drop_table("stok_masuk")
#     op.drop_index("ix_produk_unit_id", table_name="produk")
#     op.drop_index("ix_produk_sku", table_name="produk")
#     op.drop_table("produk")
