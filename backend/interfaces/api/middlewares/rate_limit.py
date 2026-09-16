"""Redis-backed login rate limit (multi-instance safe on DigitalOcean)."""
from __future__ import annotations

import os
import time

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

LOGIN_PATH_SUFFIX = "/auth/login"
MAX_ATTEMPTS = int(os.getenv("LOGIN_RATE_LIMIT", "10"))
WINDOW_SEC = int(os.getenv("LOGIN_RATE_WINDOW", "60"))
REDIS_URL = os.getenv("REDIS_URL", "")


class _MemoryFallback:
    """Fallback if REDIS_URL kosong (dev only)."""

    def __init__(self):
        self._store: dict[str, list[float]] = {}

    async def incr(self, key: str) -> int:
        now = time.time()
        bucket = [t for t in self._store.get(key, []) if now - t < WINDOW_SEC]
        bucket.append(now)
        self._store[key] = bucket
        return len(bucket)


class RedisRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._redis = None
        self._memory = _MemoryFallback()
        if REDIS_URL:
            try:
                import redis.asyncio as aioredis

                self._redis = aioredis.from_url(REDIS_URL, decode_responses=True)
            except Exception:
                self._redis = None

    async def _count(self, key: str) -> int:
        if self._redis is not None:
            try:
                n = await self._redis.incr(key)
                if n == 1:
                    await self._redis.expire(key, WINDOW_SEC)
                return int(n)
            except Exception:
                pass
        return await self._memory.incr(key)

    async def dispatch(self, request: Request, call_next):
        if request.method == "POST" and request.url.path.endswith(LOGIN_PATH_SUFFIX):
            host = request.client.host if request.client else "unknown"
            key = f"login_rl:{host}"
            count = await self._count(key)
            if count > MAX_ATTEMPTS:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Terlalu banyak percobaan login. Coba lagi nanti."},
                )
        return await call_next(request)
