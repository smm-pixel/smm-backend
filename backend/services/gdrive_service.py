"""Google Drive helper — OAuth 2.0 user delegation.
Admin authorizes 1x via /api/admin/gdrive/connect. Refresh token disimpan di collection
`oauth_tokens`. Upload memakai token ini supaya file masuk ke Drive personal user.
"""
import io
import json
import mimetypes
import os
from typing import Optional

from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

_SCOPES = ["https://www.googleapis.com/auth/drive.file"]


# 🟢 KODE SESUDAH DIUBAH (Sangat Bersih & Efisien)

def _client_config():
    # Mengambil teks string JSON rahasia langsung dari area teks DigitalOcean
    oauth_json_string = os.environ.get("GDRIVE_OAUTH_CLIENT_DATA")
    
    if not oauth_json_string:
        raise RuntimeError("Variabel lingkungan GDRIVE_OAUTH_CLIENT_DATA belum disetel!")
        
    try:
        # Mengubah teks string menjadi objek dictionary di memori RAM
        d = json.loads(oauth_json_string)
        return d.get("web") or d.get("installed") or {}
    except json.JSONDecodeError:
        raise ValueError("Struktur teks OAuth Client rusak! Pastikan formatnya satu baris rapat.")


def auth_url(state: str, redirect_uri: str) -> str:
    from urllib.parse import urlencode
    cfg = _client_config()
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return "https://accounts.google.com/o/oauth2/auth?" + urlencode(params)


def exchange_code(code: str, redirect_uri: str) -> dict:
    import requests
    cfg = _client_config()
    r = requests.post(
        cfg.get("token_uri", "https://oauth2.googleapis.com/token"),
        data={
            "code": code,
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }, timeout=15,
    )
    r.raise_for_status()
    tk = r.json()
    return {"refresh_token": tk.get("refresh_token"), "token": tk.get("access_token"),
            "scopes": (tk.get("scope") or "").split()}


def _creds_from(refresh_token: str) -> Credentials:
    cfg = _client_config()
    return Credentials(
        token=None, refresh_token=refresh_token,
        token_uri=cfg.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=cfg["client_id"], client_secret=cfg["client_secret"],
        scopes=_SCOPES,
    )


def upload_bytes(refresh_token: str, file_bytes: bytes, filename: str, mime: Optional[str] = None) -> dict:
    if not mime:
        mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    creds = _creds_from(refresh_token)
    if not creds.valid:
        creds.refresh(GoogleRequest())
    svc = build("drive", "v3", credentials=creds, cache_discovery=False)
    folder_id = os.environ["GDRIVE_FOLDER_ID"]
    body = {"name": filename, "parents": [folder_id]}
    media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mime, resumable=False)
    resp = svc.files().create(
        body=body, media_body=media,
        fields="id, name, mimeType, webViewLink, webContentLink",
    ).execute()
    try:
        svc.permissions().create(
            fileId=resp["id"], body={"role": "reader", "type": "anyone"},
        ).execute()
    except Exception:
        pass
    return resp


def delete_file(refresh_token: str, file_id: str) -> bool:
    try:
        creds = _creds_from(refresh_token)
        if not creds.valid:
            creds.refresh(GoogleRequest())
        build("drive", "v3", credentials=creds, cache_discovery=False).files().delete(fileId=file_id).execute()
        return True
    except Exception:
        return False


def file_exists(refresh_token: str, file_id: str) -> bool:
    """True jika file masih ada di Drive dan belum di-trash. False jika 404/403/trashed."""
    try:
        creds = _creds_from(refresh_token)
        if not creds.valid:
            creds.refresh(GoogleRequest())
        svc = build("drive", "v3", credentials=creds, cache_discovery=False)
        f = svc.files().get(fileId=file_id, fields="id, trashed").execute()
        return not f.get("trashed", False)
    except Exception:
        return False
