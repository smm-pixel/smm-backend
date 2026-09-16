"""COA / Account lookup — filtered by unit_usaha_id / group."""
from __future__ import annotations

from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.database.models import Account


class AccountRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, account_id: str) -> Optional[Account]:
        return await self.session.get(Account, account_id)

    async def get_by_code(
        self, code: str, group: Optional[str] = None
    ) -> Optional[Account]:
        stmt = select(Account).where(Account.code == code, Account.active.is_(True))
        if group:
            stmt = stmt.where(Account.group == group)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def list_by_unit(
        self,
        unit_usaha_id: Optional[str] = None,
        group: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Sequence[Account]:
        stmt = select(Account).where(Account.active.is_(True)).order_by(Account.code)
        if unit_usaha_id is not None:
            stmt = stmt.where(Account.unit_usaha_id == unit_usaha_id)
        if group:
            stmt = stmt.where(Account.group == group)
        if category:
            stmt = stmt.where(Account.category == category)
        return (await self.session.execute(stmt)).scalars().all()

    async def map_by_codes(
        self, codes: list[str], group: Optional[str] = None
    ) -> dict[str, Account]:
        """Return {code: Account} for validation in one query."""
        stmt = select(Account).where(Account.code.in_(codes), Account.active.is_(True))
        if group:
            stmt = stmt.where(Account.group == group)
        rows = (await self.session.execute(stmt)).scalars().all()
        return {a.code: a for a in rows}
