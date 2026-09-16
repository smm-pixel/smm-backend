"""PostgreSQL connection — pure SQLAlchemy async/sync session.
Replaces the old JSONB document-store layer in database.py.
"""
from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from infrastructure.database.models import Base


def _database_url() -> str:
    url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL wajib dikonfigurasi")
    parts = urlsplit(url)
    if parts.scheme not in {"postgresql", "postgres"}:
        raise RuntimeError("DATABASE_URL harus menggunakan PostgreSQL")
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k not in {"channel_binding", "sslmode"}
    ]
    clean = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    return (
        clean.replace("postgresql://", "postgresql+asyncpg://", 1)
        .replace("postgres://", "postgresql+asyncpg://", 1)
    )


_ssl_required = os.getenv("DATABASE_SSL", "require") != "disable"

engine = create_async_engine(
    _database_url(),
    connect_args={"ssl": "require" if _ssl_required else None, "timeout": 15},
    pool_pre_ping=True,
    pool_recycle=300,
    pool_timeout=15,
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db() -> None:
    """Create all relational tables (idempotent)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    await engine.dispose()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yield one session per request."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
