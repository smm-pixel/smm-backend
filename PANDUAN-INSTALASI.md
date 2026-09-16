# Panduan Instalasi

Panduan ini ditujukan untuk developer aplikasi Sistem Informasi Akuntansi dan Transparansi Keuangan BUMDes Karya Raharja.

## 1. Arsitektur

```text
frontend/  React + Vite
backend/   FastAPI + PostgreSQL + SQLAlchemy Async
```

Frontend dan backend berada dalam satu repository, tetapi dijalankan sebagai dua service.

## 2. Prasyarat

- Git
- Python 3.11 atau lebih baru
- Node.js minimal 20
- Yarn 1
- PostgreSQL 14 atau lebih baru
- `doctl` jika melakukan deployment ke DigitalOcean App Platform

## 3. Clone repository

```bash
git clone <URL_REPOSITORY>
cd <NAMA_REPOSITORY>
```

## 4. Konfigurasi backend

```bash
cd backend
python -m venv .venv

# Linux/macOS
source .venv/bin/activate

# Windows PowerShell
# .venv\\Scripts\\Activate.ps1

pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://user:password@host/database?sslmode=require
JWT_SECRET=ganti-dengan-secret-random-yang-panjang
CORS_ORIGINS=http://localhost:3000
# Seed master data berjalan otomatis sekali saat database belum diinisialisasi
```

`JWT_SECRET` wajib menggunakan nilai rahasia yang kuat dan tidak boleh disimpan di Git.

Google Drive hanya diperlukan untuk fitur penyimpanan bukti transaksi:

```env
GDRIVE_OAUTH_CLIENT_DATA={"web":{"client_id":"...","client_secret":"..."}}
GDRIVE_FOLDER_ID=<folder-id>
GDRIVE_REDIRECT_URI=http://localhost:8000/api/gdrive/oauth-callback
GDRIVE_OAUTH_REDIRECT=http://localhost:8000/api/gdrive/oauth-callback
```

## 5. Menjalankan backend

```bash
cd backend
source .venv/bin/activate
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Endpoint pemeriksaan:

- `http://localhost:8000/`
- `http://localhost:8000/docs`
- `http://localhost:8000/openapi.json`

Saat backend pertama kali terhubung ke database, aplikasi menginisialisasi master data terbaru dari `backend/seed_data.py`, termasuk 142 akun COA dan 6 unit usaha. Setelah berhasil, marker `seed_data_version` mencegah seed dijalankan ulang pada startup berikutnya.

## 6. Konfigurasi dan menjalankan frontend

Buka terminal baru:

```bash
cd frontend
cp .env.example .env
yarn install --frozen-lockfile
```

Isi `frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:8000
```

Jalankan:

```bash
yarn start
```

Frontend tersedia di `http://localhost:3000`.

## 7. Validasi sebelum commit

```bash
cd backend
python -m compileall -q .
pytest

cd ../frontend
yarn build
```

Jalankan `git diff --check` dari root repository untuk mendeteksi whitespace error.

## 8. Deployment DigitalOcean App Platform

Manifest satu aplikasi tersedia di `.do/app.yaml`. Manifest tersebut menjalankan dua component dari repository yang sama:

- Service backend: source directory `/backend`
- Static site frontend: source directory `/frontend`

Validasi dan deploy:

```bash
doctl apps spec validate .do/app.yaml
doctl apps create --spec .do/app.yaml
```

Untuk update aplikasi:

```bash
doctl apps update <APP_ID> --spec .do/app.yaml
```

Konfigurasi production penting:

- Backend: `DATABASE_URL` wajib menggunakan koneksi PostgreSQL ber-SSL, `JWT_SECRET`, `CORS_ORIGINS`
- Frontend build: `VITE_BACKEND_URL=https://<backend-domain>`

`VITE_BACKEND_URL` harus sudah tersedia pada saat build frontend.

## 9. Keamanan dan operasional

- Jangan commit `.env`, password, JWT secret, credential Google Drive, atau token API.
- Ganti password default segera setelah instalasi pertama.
- Backup PostgreSQL sebelum mengubah seed atau menjalankan migrasi.
- Pertahankan `CORS_ORIGINS` hanya untuk domain frontend yang dipercaya.
- Jalankan migration dan seed hanya pada environment yang sesuai.
- Perubahan pada `backend/seed_data.py` dapat mengubah master akun dan unit usaha; uji laporan sebelum production.

## 10. Struktur penting

```text
backend/server.py       # entrypoint FastAPI
backend/config.py       # konfigurasi environment
backend/database.py     # koneksi dan akses database
backend/startup.py      # inisialisasi database dan seed
backend/seed_data.py    # sumber master data awal
frontend/src/App.jsx    # routing frontend
.do/app.yaml            # deployment DigitalOcean
```

## 11. Troubleshooting singkat

### Frontend tidak dapat memanggil API

Periksa `VITE_BACKEND_URL`, `CORS_ORIGINS`, port backend, dan cookie session.

### Seed tidak muncul

Pastikan database dapat diakses dan log backend tidak menunjukkan error startup. Seed otomatis hanya berjalan saat marker `seed_data_version` belum ada atau versinya lebih rendah.

### Login gagal setelah deployment

Periksa `JWT_SECRET`, `CORS_ORIGINS`, HTTPS, dan konfigurasi cookie pada domain frontend/backend.

### Build frontend gagal

Hapus `node_modules` hanya jika diperlukan, lalu jalankan kembali:

```bash
yarn install --frozen-lockfile
yarn build
```

## 12. Sumber kebenaran

- Konfigurasi COA dan unit usaha: `backend/seed_data.py`
- Struktur dan status deployment: `.do/app.yaml`
- Endpoint API: `/docs` atau `/openapi.json`
- Ringkasan arsitektur: `README.md`

---

Dokumen ini menjelaskan instalasi dan deployment developer. Untuk alur kerja pengguna, lihat `PANDUAN-PENGGUNAAN.md`.
