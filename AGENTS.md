# Base44 Dev Environment — BUMDes Karya Raharja SIA

## Overview

Fullstack accounting app: React+Vite SPA frontend, FastAPI+PostgreSQL backend.
Both live in the same repo as `frontend/` and `backend/`.

## Architecture

- **Single-origin wiring**: Vite dev server (port 3000) proxies `/api` to the FastAPI backend (port 8000, internal). This keeps cookie-based auth (HttpOnly + SameSite=None + Secure) working through the HTTPS preview proxy.
- `VITE_BACKEND_URL` is intentionally unset — the frontend falls back to `window.location.origin`, so all API calls go through the Vite proxy.
- `CORS_ORIGINS` is set dynamically via compose to `https://3000-${BASE44_PUBLIC_HOST_SUFFIX},https://3001-${BASE44_PUBLIC_HOST_SUFFIX},http://localhost:3000,http://localhost:5174` so the backend's CSRF origin check passes for both frontends.

## Services (docker-compose.base44.yml)

| Service  | Image             | Port | Notes |
|----------|-------------------|------|-------|
| db       | postgres:16-alpine | 5432 (internal) | Healthcheck via `pg_isready` |
| backend  | python:3.11-slim  | 8000 (internal) | `uvicorn --reload`, runs Alembic migrations + seeds on startup |
| frontend | node:20           | 3000 (public)   | `yarn start` → Vite dev server with HMR |
| frontend-stok | node:20       | 3001 (public)   | Inventory app for UU05 (`frontend-stok/`), `npm start` → Vite on 5174, proxies `/api` to backend. Versions aligned with main frontend (React 19, router 7, Vite 8) |

## Required env vars

- `DATABASE_URL` — set in compose (local postgres, not a secret)
- `DATABASE_SSL` — set to `disable` in compose for local postgres (no SSL)
- `CORS_ORIGINS` — set in compose (dynamic, not a secret)
- `JWT_SECRET` — **secret**, generated as dev placeholder, delivered via `/run/base44/app.env`
- GDRIVE_* and Stripe — optional, only needed for Google Drive proof-file storage / payments. App boots without them.

## Code changes for local dev

- `backend/database.py`: SSL is now conditional via `DATABASE_SSL` env var (default `require`, set `disable` for local postgres).
- `frontend/vite.config.mjs`: Added `allowedHosts: true` and proxy for `/api` → `http://backend:8000`.

## Default seed users

- admin@bumdes.id / admin123 (Admin)
- budianto@bumdes.id / direktur123 (Direktur)
- riska@bumdes.id / bendahara123 (Bendahara)

## Verifying the app

1. `docker compose -f docker-compose.base44.yml up -d --build`
2. Check `docker compose ps` — all services healthy
3. Curl `http://localhost:3000/` — should serve the React SPA
4. Login at the UI with seed credentials
5. Backend health: `http://localhost:8000/health`
