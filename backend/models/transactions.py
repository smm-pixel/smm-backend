from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field
from .base import BaseRecord, now_utc

class Transaction(BaseRecord):
    date: str  # YYYY-MM-DD
    unit_usaha_id: Optional[str] = None  # null = bumdes-level
    transaction_type: str  # e.g. "penerimaan_bagi_hasil", "beban_operasional", "modal_mitra", etc
    description: str
    amount: Decimal = Field(gt=Decimal("0"), max_digits=20, decimal_places=2)
    debit_account_code: str
    credit_account_code: str
    mitra_id: Optional[str] = None
    reference: str = ""  # optional invoice/nota number
    created_by: str  # user id
    created_at: datetime = Field(default_factory=now_utc)

class TransactionCreate(BaseModel):
    date: str
    unit_usaha_id: Optional[str] = None
    transaction_type: str
    description: str
    amount: Decimal = Field(gt=Decimal("0"), max_digits=20, decimal_places=2)
    debit_account_code: str
    credit_account_code: str
    mitra_id: Optional[str] = None
    reference: str = ""

class RevenueShare(BaseRecord):
    period: str  # YYYY-MM
    unit_usaha_id: str
    gross_revenue: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"), max_digits=20, decimal_places=2)
    operational_cost: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"), max_digits=20, decimal_places=2)
    net_revenue: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"), max_digits=20, decimal_places=2)  # gross - op cost
    manager_share: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"), max_digits=20, decimal_places=2)  # 30%
    bumdes_share: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"), max_digits=20, decimal_places=2)  # 70%
    manager_user_id: Optional[str] = None
    status: str = "draft"  # draft | disetor
    settled_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc)

class RevenueShareCreate(BaseModel):
    period: str
    unit_usaha_id: str
    gross_revenue: Decimal = Field(gt=Decimal("0"), max_digits=20, decimal_places=2)
    operational_cost: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"), max_digits=20, decimal_places=2)
