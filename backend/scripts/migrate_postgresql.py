"""Explicit, idempotent PostgreSQL schema migration entry point."""
from __future__ import annotations

import argparse
import asyncio

from database import close_database, init_database
from startup import _ensure_indexes


async def migrate(*, seed: bool = False) -> None:
    """Create/update PostgreSQL schema without deleting application data."""
    await init_database()
    await _ensure_indexes()
    if seed:
        from startup import seed_startup

        await seed_startup()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Apply idempotent PostgreSQL schema changes")
    parser.add_argument("--seed", action="store_true", help="Apply the application seed after schema migration")
    args = parser.parse_args()
    try:
        await migrate(seed=args.seed)
    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(main())
