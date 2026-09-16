"""Reports API — delegates to GenerateFinancialReportUseCase.
Paths: /api/reports/laba-rugi, /neraca, /buku-besar — unchanged.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from config import API_PREFIX
from infrastructure.database.connection import get_db
from application.reports.generate_financial_report_use_case import (
    GenerateFinancialReportUseCase,
)

router = APIRouter(prefix=API_PREFIX)


@router.get("/reports/laba-rugi")
async def rpt_laba_rugi(
    start_date: date,
    end_date: date,
    unit_usaha_id: Optional[str] = None,
    group: Optional[str] = None,
    session: AsyncSession = Depends(get_db),
):
    uc = GenerateFinancialReportUseCase(session)
    return await uc.laba_rugi(
        unit_usaha_id=unit_usaha_id,
        group=group,
        date_from=start_date,
        date_to=end_date,
    )


@router.get("/reports/neraca")
async def rpt_neraca(
    as_of_date: date,
    unit_usaha_id: Optional[str] = None,
    group: Optional[str] = None,
    session: AsyncSession = Depends(get_db),
):
    uc = GenerateFinancialReportUseCase(session)
    return await uc.neraca(
        unit_usaha_id=unit_usaha_id,
        group=group,
        as_of=as_of_date,
    )


@router.get("/reports/buku-besar")
async def rpt_buku_besar(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    unit_usaha_id: Optional[str] = None,
    group: Optional[str] = None,
    account_code: Optional[str] = None,
    session: AsyncSession = Depends(get_db),
):
    uc = GenerateFinancialReportUseCase(session)
    return await uc.buku_besar(
        unit_usaha_id=unit_usaha_id,
        group=group,
        account_code=account_code,
        date_from=start_date,
        date_to=end_date,
    )
