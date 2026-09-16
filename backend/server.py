"""Compatibility shim — DigitalOcean / uvicorn may still point to server:app.
Real entrypoint is main.py (Clean Architecture).
"""
from main import app  # noqa: F401
