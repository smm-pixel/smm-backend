"""Relational SQLAlchemy models — replaces application_entities JSONB document store.

Double-entry accounting, multi-tenant via unit_usaha_id FK, NUMERIC(20,2) money.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class UnitUsaha(Base):
    __tablename__ = "unit_usaha"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    revenue_scheme: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="unit_usaha")
    accounts: Mapped[list["Account"]] = relationship(back_populates="unit_usaha")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="unit_usaha")
    mitra_list: Mapped[list["Mitra"]] = relationship(back_populates="unit_usaha")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), default="")
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    unit_usaha_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("unit_usaha.id", ondelete="SET NULL"), nullable=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    unit_usaha: Mapped[Optional["UnitUsaha"]] = relationship(back_populates="users")

    __table_args__ = (Index("ix_users_unit_usaha_id", "unit_usaha_id"),)


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    subcategory: Mapped[str] = mapped_column(String(50), default="")
    normal_balance: Mapped[str] = mapped_column(String(10), nullable=False)
    parent_code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    group: Mapped[str] = mapped_column(String(10), nullable=False, default="BUMDES")
    unit_usaha_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("unit_usaha.id", ondelete="SET NULL"), nullable=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    unit_usaha: Mapped[Optional["UnitUsaha"]] = relationship(back_populates="accounts")
    lines: Mapped[list["TransactionLine"]] = relationship(back_populates="account")

    __table_args__ = (
        UniqueConstraint("code", "group", name="uq_accounts_code_group"),
        Index("ix_accounts_unit_usaha_id", "unit_usaha_id"),
        Index("ix_accounts_category", "category"),
        CheckConstraint(
            "category IN ('aset','kewajiban','ekuitas','pendapatan','beban')",
            name="ck_accounts_category",
        ),
        CheckConstraint(
            "normal_balance IN ('debit','kredit')",
            name="ck_accounts_normal_balance",
        ),
    )


class Mitra(Base):
    __tablename__ = "mitra"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    unit_usaha_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("unit_usaha.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    mitra_type: Mapped[str] = mapped_column(String(50), default="")
    phone: Mapped[str] = mapped_column(String(30), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    modal: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0.00"), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    unit_usaha: Mapped["UnitUsaha"] = relationship(back_populates="mitra_list")

    __table_args__ = (Index("ix_mitra_unit_usaha_id", "unit_usaha_id"),)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    nomor_bukti: Mapped[str] = mapped_column(String(50), default="")
    keterangan: Mapped[str] = mapped_column(Text, nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(50), default="")
    unit_usaha_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("unit_usaha.id", ondelete="SET NULL"), nullable=True
    )
    mitra_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("mitra.id", ondelete="SET NULL"), nullable=True
    )
    created_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    unit_usaha: Mapped[Optional["UnitUsaha"]] = relationship(back_populates="transactions")
    lines: Mapped[list["TransactionLine"]] = relationship(
        back_populates="transaction", cascade="all, delete-orphan"
    )
    bukti: Mapped[list["BuktiTransaksi"]] = relationship(
        back_populates="transaction", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_transactions_date", "date"),
        Index("ix_transactions_unit_usaha_id", "unit_usaha_id"),
        Index("ix_transactions_nomor_bukti", "nomor_bukti"),
    )


class TransactionLine(Base):
    __tablename__ = "transaction_lines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    transaction_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False
    )
    debit: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0.00"), nullable=False)
    kredit: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0.00"), nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="")

    transaction: Mapped["Transaction"] = relationship(back_populates="lines")
    account: Mapped["Account"] = relationship(back_populates="lines")

    __table_args__ = (
        Index("ix_transaction_lines_transaction_id", "transaction_id"),
        Index("ix_transaction_lines_account_id", "account_id"),
        CheckConstraint("debit >= 0 AND kredit >= 0", name="ck_line_non_negative"),
        CheckConstraint(
            "(debit > 0 AND kredit = 0) OR (kredit > 0 AND debit = 0)",
            name="ck_line_debit_xor_kredit",
        ),
    )


class BuktiTransaksi(Base):
    __tablename__ = "bukti_transaksi"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    transaction_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
    )
    gdrive_file_id: Mapped[str] = mapped_column(String(120), nullable=False)
    gdrive_url: Mapped[str] = mapped_column(String(500), default="")
    file_name: Mapped[str] = mapped_column(String(255), default="")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    transaction: Mapped["Transaction"] = relationship(back_populates="bukti")

    __table_args__ = (Index("ix_bukti_transaction_id", "transaction_id"),)


class RevenueShare(Base):
    __tablename__ = "revenue_shares"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    period: Mapped[str] = mapped_column(String(7), nullable=False)
    unit_usaha_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("unit_usaha.id", ondelete="CASCADE"), nullable=False
    )
    gross_revenue: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0.00"), nullable=False)
    operational_cost: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0.00"), nullable=False)
    net_revenue: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0.00"), nullable=False)
    manager_share: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0.00"), nullable=False)
    bumdes_share: Mapped[Decimal] = mapped_column(Numeric(20, 2), default=Decimal("0.00"), nullable=False)
    manager_user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    settled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("period", "unit_usaha_id", name="uq_revenue_period_unit"),
        Index("ix_revenue_shares_unit_usaha_id", "unit_usaha_id"),
    )


class Period(Base):
    __tablename__ = "periods"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    period: Mapped[str] = mapped_column(String(7), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    ip_address: Mapped[str] = mapped_column(String(64), default="")
    payload_before: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload_after: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_audit_logs_user_id", "user_id"),
        Index("ix_audit_logs_action", "action"),
        Index("ix_audit_logs_timestamp", "timestamp"),
    )
