"""BUMDES Karya Raharja - Financial Reporting App
Backend API sesuai Kepmendesa PDTT No 136/2022.
"""
import os
import io
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query, Request, Response, UploadFile, File
from fastapi.responses import StreamingResponse, HTMLResponse
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uuid
from typing import Any

from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle,
)

from services.document_pdf import (
    STYLES as _STYLES,
    CELL_STYLE as _CELL_STYLE,
    CELL_RIGHT as _CELL_RIGHT,
    CELL_BOLD as _CELL_BOLD,
    CELL_BOLD_RIGHT as _CELL_BOLD_RIGHT,
    P, pdf_response as _pdf_response,
    pdf_header, table_style as _table_style,
    section_row as _section_row,
    signature_block as _sig_flow,
)


def _pdf_header(story, styles, title: str, subtitle: str = ""):
    """Backwards-compatible wrapper (ignores `styles` arg, uses pdf_utils.STYLES)."""
    pdf_header(story, title, subtitle)


def _signature_block():
    return _sig_flow("Direktur BUM Desa", "Bendahara", "")

from models import (
    User, UserCreate, UserLogin, UserOut, UserRole, PasswordResetRequest, ChangePasswordRequest, ProfileUpdateRequest,
    UnitUsaha, UnitUsahaCreate,
    Mitra, MitraCreate,
    Account, AccountCreate,
    Transaction, TransactionCreate,
    RevenueShare, RevenueShareCreate,
    now_utc,
)
from services.jwt_service import (
    hash_password, verify_password, create_access_token,
    get_current_user_payload, require_roles, COOKIE_NAME, ACCESS_TOKEN_EXPIRE_HOURS,
)
from seed_data import (
    CHART_OF_ACCOUNTS,
    EXAMPLE_ROWS_BUMDES,
    EXAMPLE_ROWS_UNIT,
    UNIT_USAHA_SEED,
    VALID_CATEGORIES,
    VALID_ACCOUNT_CATEGORIES,
)

# Kept as compatibility symbols for modular routers; database access is PostgreSQL-backed.
DatabaseClient = Any
client = None

# Role constants are centralized in config.py and imported above.


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from database import close_database, db  # noqa: E402
from services.reporting_service import (  # noqa: E402
    _get_accounts_map, _group_from_unit,
    _calc_balances, _calc_balances_before,
    _ledger_data, _laba_rugi, _neraca, _arus_kas,
    _perubahan_ekuitas, _per_unit_report,
)
from config import API_PREFIX, APP_TITLE, READ_LEVEL, REPORT_READ_LEVEL, WRITE_LEVEL, ADMIN_LEVEL, READONLY_ROLES
from dependencies import fmt_rp, user_from_payload, scope_unit_for_pengelola, require_not_readonly, require_password_ready
from startup import seed_startup as seed_database


async def _group_from_unit(unit_usaha_id: Optional[str]) -> str:
    """Resolve report group without relying on a re-exported helper."""
    if not unit_usaha_id:
        return "BUMDES"
    unit = await db.unit_usaha.select_one({"id": unit_usaha_id}, None)
    return (unit or {}).get("code") or "BUMDES"


async def _check_period_not_blocked(dep: dict, date_value: str) -> None:
    """Reject writes to a period closed for the transaction's group."""
    if not date_value or len(date_value) < 7:
        return
    period = date_value[:7]
    unit_id = dep.get("unit")
    group = "BUMDES"
    if unit_id:
        unit = await db.unit_usaha.select_one({"id": unit_id}, {"_id": 0, "code": 1})
        group = unit.get("code") if unit else "BUMDES"
    if await db.closed_periods.select_one({"period": period, "group": group}, {"_id": 0}):
        raise HTTPException(status_code=409, detail=f"Periode {period} ({group}) sudah ditutup")


async def _check_period_not_closed(unit_id: Optional[str], date_value: str) -> None:
    """Reject writes to a period closed for the target unit or BUMDES."""
    if not date_value or len(date_value) < 7:
        return
    period = date_value[:7]
    group = "BUMDES"
    if unit_id:
        unit = await db.unit_usaha.select_one({"id": unit_id}, {"_id": 0, "code": 1})
        group = unit.get("code") if unit else "BUMDES"
    if await db.closed_periods.select_one({"period": period, "group": group}, {"_id": 0}):
        raise HTTPException(status_code=409, detail=f"Periode {period} ({group}) sudah ditutup")

app = FastAPI(title=APP_TITLE)

router = APIRouter(prefix=API_PREFIX)
