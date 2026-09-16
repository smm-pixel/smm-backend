"""Pencatatan audit log aktivitas akuntansi."""
from __future__ import annotations

import json
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.database.models import AuditLog


class AuditLogService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def record(
        self,
        *,
        action: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        payload_before: Any = None,
        payload_after: Any = None,
    ) -> AuditLog:
        def _ser(v: Any) -> Optional[str]:
            if v is None:
                return None
            if isinstance(v, str):
                return v
            try:
                return json.dumps(v, default=str)
            except Exception:
                return str(v)

        row = AuditLog(
            user_id=user_id,
            action=action,
            ip_address=ip_address or "",
            payload_before=_ser(payload_before),
            payload_after=_ser(payload_after),
        )
        self.session.add(row)
        await self.session.flush()
        return row
