"""Typed PostgreSQL persistence primitives used by the application."""
from __future__ import annotations

import asyncio
import copy
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import CheckConstraint, DateTime, Index, Numeric, String, and_, cast, delete, func, or_, select, text, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from fastapi.encoders import jsonable_encoder


def _database_url() -> str:
    url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if not url:
        raise RuntimeError("DATABASE_URL wajib dikonfigurasi")
    parts = urlsplit(url)
    if parts.scheme not in {"postgresql", "postgres"}:
        raise RuntimeError("DATABASE_URL harus menggunakan PostgreSQL")
    query = [(key, value) for key, value in parse_qsl(parts.query, keep_blank_values=True) if key not in {"channel_binding", "sslmode"}]
    clean_url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    return clean_url.replace("postgresql://", "postgresql+asyncpg://", 1).replace("postgres://", "postgresql+asyncpg://", 1)


class Base(DeclarativeBase):
    pass


class StoredEntity(Base):
    __tablename__ = "application_entities"
    namespace: Mapped[str] = mapped_column(String(80), primary_key=True)
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    __table_args__ = (
        Index("ix_application_entities_namespace_updated", "namespace", "updated_at"),
        Index("ix_application_entities_payload_gin", "payload", postgresql_using="gin"),
        CheckConstraint("NOT (payload ? 'amount') OR jsonb_typeof(payload->'amount') IN ('number', 'string')", name="ck_entities_amount_type"),
    )


_ssl_required = os.getenv("DATABASE_SSL", "require") != "disable"
engine = create_async_engine(
    _database_url(),
    connect_args={"ssl": "require" if _ssl_required else None, "timeout": 15},
    pool_pre_ping=True,
    pool_recycle=300,
    pool_timeout=15,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


def _path(value: dict[str, Any], key: str) -> Any:
    current: Any = value
    for part in key.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _matches_filter(value: dict[str, Any], criteria: dict[str, Any]) -> bool:
    for key, expected in criteria.items():
        if key == "any_of":
            if not any(_matches_filter(value, branch) for branch in expected): return False
            continue
        if key == "all_of":
            if not all(_matches_filter(value, branch) for branch in expected): return False
            continue
        actual = _path(value, key)
        if isinstance(expected, dict) and any(op in expected for op in ("exists", "in", "not_in", "not_equal", "at_least", "above", "at_most", "below", "gte", "gt", "lte", "lt", "$exists", "$in", "$nin", "$ne", "$gte", "$gt", "$lte", "$lt")):
            for raw_op, operand in expected.items():
                op = {"$exists": "exists", "$in": "in", "$nin": "not_in", "$ne": "not_equal", "$gte": "at_least", "$gt": "above", "$lte": "at_most", "$lt": "below"}.get(raw_op, raw_op)
                if op == "exists" and ((actual is not None) != bool(operand)): return False
                if op == "in" and actual not in operand: return False
                if op == "not_in" and actual in operand: return False
                if op == "not_equal" and actual == operand: return False
                if op in {"at_least", "above", "at_most", "below"}:
                    if actual is None: return False
                    try:
                        left, right = actual, operand
                        if isinstance(left, (int, float, Decimal)) or isinstance(right, (int, float, Decimal)):
                            left, right = Decimal(str(left)), Decimal(str(right))
                        elif type(left) is not type(right): left, right = str(left), str(right)
                        if op == "at_least" and left < right: return False
                        if op == "above" and left <= right: return False
                        if op == "at_most" and left > right: return False
                        if op == "below" and left >= right: return False
                    except (TypeError, ValueError, ArithmeticError): return False
            continue
        if actual != expected: return False
    return True


def _json_value(key: str):
    expression = StoredEntity.payload
    for part in key.split("."):
        expression = expression[part]
    value = expression.as_string()
    if key.endswith(("amount", "total", "balance")):
        return cast(value, Numeric(20, 2))
    return value


def _matches(value: dict[str, Any], criteria: dict[str, Any]) -> bool:
    """Compatibility helper for pure-Python regression tests."""
    return _matches_filter(value, criteria)


def _query_condition(criteria: dict[str, Any]):
    """Build a SQLAlchemy condition for PostgreSQL JSONB data."""
    return _filter_condition(criteria)


def _filter_condition(criteria: dict[str, Any]):
    conditions = []
    for key, expected in criteria.items():
        if key in {"any_of", "$or"}:
            conditions.append(or_(*(_filter_condition(branch) for branch in expected))); continue
        if key in {"all_of", "$and"}:
            conditions.append(and_(*(_filter_condition(branch) for branch in expected))); continue
        column = _json_value(key)
        if expected is None:
            # JSONB stores null as a JSON value, while missing keys resolve to SQL NULL.
            json_value = StoredEntity.payload[key]
            conditions.append(or_(json_value.is_(None), json_value == text("'null'::jsonb")))
            continue
        if isinstance(expected, dict):
            for raw_op, value in expected.items():
                op = {"$exists": "exists", "$in": "in", "$nin": "not_in", "$ne": "not_equal", "$gte": "at_least", "$gt": "above", "$lte": "at_most", "$lt": "below"}.get(raw_op, raw_op)
                if op == "exists": conditions.append(StoredEntity.payload[key].is_not(None) if value else StoredEntity.payload[key].is_(None))
                elif op == "in": conditions.append(column.in_([str(item) for item in value]))
                elif op == "not_in": conditions.append(column.not_in([str(item) for item in value]))
                elif op == "not_equal": conditions.append(column != str(value))
                elif op == "at_least": conditions.append(column >= value)
                elif op == "above": conditions.append(column > value)
                elif op == "at_most": conditions.append(column <= value)
                elif op == "below": conditions.append(column < value)
            continue
        conditions.append(column == str(expected))
    return and_(*conditions) if conditions else True


def _project(payload: dict[str, Any], projection: dict[str, int] | None) -> dict[str, Any]:
    result = copy.deepcopy(payload)
    if not projection: return result
    included = [key for key, flag in projection.items() if flag and key != "_id"]
    if included: return {key: _path(payload, key) for key in included if _path(payload, key) is not None}
    for key, flag in projection.items():
        if not flag: result.pop(key, None)
    return result


@dataclass
class OperationResult:
    inserted_id: str | None = None
    modified_count: int = 0
    deleted_count: int = 0
    matched_count: int = 0


class Query:
    def __init__(self, loader): self._loader, self._ops = loader, []
    def order(self, key: str, direction: int): self._ops.append(("order", key, direction)); return self
    def offset(self, amount: int): self._ops.append(("offset", amount)); return self
    def limit(self, amount: int): self._ops.append(("limit", amount)); return self
    async def all(self, length: int = 0): return await self._loader(self._ops, length)
    def __aiter__(self): return self._iterate()
    async def _iterate(self):
        for item in await self.all(): yield item


class Repository:
    def __init__(self, namespace: str): self.namespace = namespace
    def select(self, criteria=None, projection=None):
        async def loader(ops, length):
            statement = select(StoredEntity).where(StoredEntity.namespace == self.namespace, _filter_condition(criteria or {}))
            for op in ops:
                if op[0] == "order": statement = statement.order_by(_json_value(op[1]).desc() if op[2] < 0 else _json_value(op[1]).asc())
                elif op[0] == "offset": statement = statement.offset(op[1])
                elif op[0] == "limit": statement = statement.limit(op[1])
            if length: statement = statement.limit(length)
            async with SessionLocal() as session:
                rows = (await session.execute(statement)).scalars()
                return [_project(copy.deepcopy(row.payload), projection) for row in rows]
        return Query(loader)
    async def select_one(self, criteria=None, projection=None):
        rows = await self.select(criteria, projection).all(1); return rows[0] if rows else None
    async def count(self, criteria=None):
        async with SessionLocal() as session:
            return int((await session.scalar(select(func.count()).select_from(StoredEntity).where(StoredEntity.namespace == self.namespace, _filter_condition(criteria or {})))) or 0)
    async def unique_values(self, key, criteria=None):
        async with SessionLocal() as session:
            expression = _json_value(key)
            rows = (await session.execute(select(expression).where(StoredEntity.namespace == self.namespace, _filter_condition(criteria or {})).distinct())).scalars()
            return [value for value in rows if value is not None]
    async def create_index(self, field, **options):
        fields = field if isinstance(field, list) else [(field, 1)]
        safe = re.compile(r"^[A-Za-z_][A-Za-z0-9_.]*$")
        parts = [f"((payload #>> '{{{name.replace('.', ',')}}}')) {'DESC' if direction < 0 else 'ASC'}" for name, direction in fields if safe.match(name)]
        if not parts: raise ValueError("Invalid index field")
        index_name = "ix_entities_" + self.namespace + "_" + "_".join(name.replace('.', '_') for name, _ in fields)
        index_name = re.sub(r"[^A-Za-z0-9_]", "_", index_name)[:60]
        unique = "UNIQUE " if options.get("unique") else ""
        async with engine.begin() as connection:
            await connection.execute(text(f'CREATE {unique} INDEX IF NOT EXISTS "{index_name}" ON application_entities (namespace, {", ".join(parts)})'))
        return index_name
    async def create(self, payload):
        item = jsonable_encoder(copy.deepcopy(payload)); item_id = str(item.get("id")); now = datetime.now(timezone.utc)
        async with SessionLocal.begin() as session: session.add(StoredEntity(namespace=self.namespace, id=item_id, payload=item, created_at=now, updated_at=now))
        return OperationResult(inserted_id=item_id)
    async def create_many(self, payloads):
        if not payloads: return OperationResult()
        now = datetime.now(timezone.utc)
        async with SessionLocal.begin() as session:
            session.add_all([StoredEntity(namespace=self.namespace, id=str(item.get("id")), payload=jsonable_encoder(copy.deepcopy(item)), created_at=now, updated_at=now) for item in payloads])
        return OperationResult()
    async def modify_one(self, criteria, changes, upsert=False): return await self._modify(criteria, changes, upsert, True)
    async def modify_many(self, criteria, changes, upsert=False): return await self._modify(criteria, changes, upsert, False)
    async def _modify(self, criteria, changes, upsert, one):
        async with SessionLocal.begin() as session:
            statement = select(StoredEntity).where(StoredEntity.namespace == self.namespace, _filter_condition(criteria))
            if one: statement = statement.limit(1)
            rows = list((await session.execute(statement)).scalars())
            if not rows and upsert:
                data = {k: v for k, v in criteria.items() if not k.startswith("$") and not isinstance(v, dict)}
                data.update(changes.get("set", changes)); data.setdefault("id", os.urandom(12).hex())
                data = jsonable_encoder(data)
                now = datetime.now(timezone.utc); session.add(StoredEntity(namespace=self.namespace, id=str(data["id"]), payload=data, created_at=now, updated_at=now)); return OperationResult(inserted_id=str(data["id"]))
            for row in rows:
                data = copy.deepcopy(row.payload); data.update(changes.get("set", {}))
                for key in changes.get("unset", {}): data.pop(key, None)
                row.payload, row.updated_at = jsonable_encoder(data), datetime.now(timezone.utc)
            return OperationResult(modified_count=len(rows), matched_count=len(rows))
    async def remove_one(self, criteria): return await self._remove(criteria, True)
    async def remove_many(self, criteria): return await self._remove(criteria, False)
    async def _remove(self, criteria, one):
        async with SessionLocal.begin() as session:
            where = [StoredEntity.namespace == self.namespace, _filter_condition(criteria)]
            if one:
                row_id = await session.scalar(select(StoredEntity.id).where(*where).limit(1))
                if not row_id: return OperationResult()
                result = await session.execute(delete(StoredEntity).where(StoredEntity.namespace == self.namespace, StoredEntity.id == row_id))
            else:
                result = await session.execute(delete(StoredEntity).where(*where))
            return OperationResult(deleted_count=result.rowcount or 0)


class Database:
    def __getattr__(self, name): return Repository(name)


db = Database()

async def migrate_schema() -> None:
    from alembic import command
    from alembic.config import Config

    config = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
    await asyncio.to_thread(command.upgrade, config, "head")


async def init_database() -> None:
    await migrate_schema()


async def applied_migrations() -> list[str]:
    async with SessionLocal() as session:
        rows = await session.execute(text("SELECT version_num FROM alembic_version ORDER BY version_num"))
        return [str(version) for version in rows.scalars()]

async def close_database() -> None: await engine.dispose()

async def get_db():
    async with SessionLocal() as session: yield session
