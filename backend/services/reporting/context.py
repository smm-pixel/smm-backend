"""Shared dependencies and safe value helpers for reporting modules."""
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

from fastapi import HTTPException

from database import db


def to_amount(value: Any) -> float:
    """Convert JSONB numeric values consistently before arithmetic."""
    if value is None or value == "":
        return 0.0
    try:
        return float(Decimal(str(value)))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=500, detail="Nilai amount transaksi tidak valid")


__all__ = ["Any", "Optional", "HTTPException", "db", "to_amount"]
