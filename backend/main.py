"""BUMDES API entrypoint — Clean Architecture bootstrap.
Path API /api/* tetap sama agar frontend & DigitalOcean tidak patah.
"""
from collections import defaultdict, deque
from time import monotonic
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from config import API_PREFIX, APP_TITLE, CORS_ORIGINS
from infrastructure.database.connection import close_db, engine, init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("bumdes.audit")

app = FastAPI(title=APP_TITLE)
_login_attempts = defaultdict(deque)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
)


@app.middleware("http")
async def validate_csrf_origin(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        if request.url.path.endswith("/auth/login"):
            now = monotonic()
            attempts = _login_attempts[request.client.host if request.client else "unknown"]
            while attempts and now - attempts[0] > 60:
                attempts.popleft()
            if len(attempts) >= 10:
                return JSONResponse(status_code=429, content={"detail": "Terlalu banyak percobaan login"})
            attempts.append(now)
        origin = request.headers.get("origin")
        referer = request.headers.get("referer")
        source = origin or (referer and "/".join(referer.split("/")[:3]))
        if source and source not in CORS_ORIGINS:
            return JSONResponse(status_code=403, content={"detail": "Permintaan lintas situs ditolak"})
    try:
        response = await call_next(request)
    except Exception as exc:
        logger.exception("unhandled method=%s path=%s", request.method, request.url.path)
        response = JSONResponse(
            status_code=500,
            content={
                "detail": "Terjadi kesalahan internal pada server",
                "error_type": type(exc).__name__,
                "error_message": str(exc)[:500],
                "path": request.url.path,
            },
        )
        origin = request.headers.get("origin")
        if origin in CORS_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        logger.info("mutation method=%s path=%s status=%s", request.method, request.url.path, response.status_code)
    return response


@app.on_event("startup")
async def on_startup():
    await init_db()
    try:
        from startup import seed_startup
        await seed_startup()
    except Exception:
        logger.warning("seed_startup skipped or failed — relational seed may be pending")


@app.on_event("shutdown")
async def on_shutdown():
    await close_db()


# ── Routers Clean Architecture (path /api/* unchanged) ──────────────────────
from interfaces.api.routers import transactions as ca_transactions  # noqa: E402
from interfaces.api.routers import reports as ca_reports  # noqa: E402
from interfaces.api.routers import stok as ca_stok  # noqa: E402
from interfaces.api.routers import proofs as ca_proofs  # noqa: E402

# Auth & legacy aggregators tetap di-include agar endpoint lain tidak patah
from routers.auth import admin_users, gdrive, profile, session  # noqa: E402
from routers import master_data_router  # noqa: E402

for auth_module in (session, profile, admin_users, gdrive):
    app.include_router(auth_module.router, prefix=API_PREFIX)

app.include_router(master_data_router.router)
app.include_router(ca_transactions.router)
app.include_router(ca_reports.router)
app.include_router(ca_proofs.router)
app.include_router(ca_stok.router)


@app.get("/")
async def root():
    return {"app": "BUMDES Karya Raharja", "version": "2.0.0-clean"}


@app.get("/health")
async def health():
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception as exc:
        logger.exception("database health check failed")
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "database": "unavailable", "error_type": type(exc).__name__},
        )
    return {"status": "ok", "database": "connected", "architecture": "clean-relational"}
