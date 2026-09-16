"""Stok router (eksperimen) — dipindah ke interfaces/api/routers tanpa ubah path.
Re-export dari routers.stok legacy agar endpoint tetap hidup.
"""
try:
    from routers.stok import router  # noqa: F401
except Exception:
    from fastapi import APIRouter

    router = APIRouter()  # placeholder jika legacy belum tersedia
