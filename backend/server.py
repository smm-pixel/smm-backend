"""BUMDES API application entrypoint. Route implementations live in routers/."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from collections import defaultdict, deque
from time import monotonic
import logging
from config import API_PREFIX, APP_TITLE, CORS_ORIGINS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("bumdes.audit")
from database import close_database, engine, init_database
from sqlalchemy import text
from startup import seed_startup as seed_database

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
    """Reject cross-site state-changing requests before they reach a router."""
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
async def seed_startup():
    await init_database()
    await seed_database()


@app.on_event("shutdown")
async def shutdown_db_client():
    await close_database()


from routers import master_data_router, transactions_router, reports_router, stok  # noqa: E402
from routers.auth import admin_users, gdrive, profile, session  # noqa: E402

# Register authentication routes directly so the deployed app cannot omit the
# nested auth routers when importing the compatibility aggregator.
for auth_module in (session, profile, admin_users, gdrive):
    app.include_router(auth_module.router, prefix=API_PREFIX)

for router_module in (master_data_router, transactions_router, reports_router, stok):
    app.include_router(router_module.router)

@app.get("/")
async def root():
    return {"app": "BUMDES Karya Raharja", "version": "1.0.0"}


@app.get("/health")
async def health():
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
            migration = await connection.scalar(text("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1"))
            entity_count = await connection.scalar(text("SELECT COUNT(*) FROM application_entities"))
    except Exception as exc:
        logger.exception("database health check failed")
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "unavailable", "error_type": type(exc).__name__})
    return {"status": "ok", "database": "connected", "migration": migration, "entities": int(entity_count or 0)}
