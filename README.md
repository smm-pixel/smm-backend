# Sistem Informasi Akuntansi dan Transparansi Keuangan
## BUMDes Karya Raharja — Desa Wonoharjo, Kecamatan Pangandaran

Sistem Informasi Akuntansi dan Transparansi Keuangan (SIA) BUMDes Karya Raharja adalah aplikasi untuk pencatatan transaksi, pengelolaan master data, penyusunan laporan keuangan, penyimpanan bukti transaksi, dan penyajian informasi keuangan secara terkontrol.

## Spesifikasi Sistem

### Arsitektur

```text
frontend/  React SPA + Vite
backend/   FastAPI + PostgreSQL + SQLAlchemy Async
```

- Frontend dan backend berada dalam folder terpisah pada repository yang sama.
- Backend menyediakan API dengan prefix `/api`.
- Data utama disimpan pada PostgreSQL.
- Autentikasi menggunakan session cookie HttpOnly dan JWT.
- Akses pengguna dikendalikan dengan Role-Based Access Control (RBAC).
- Bukti transaksi dapat disimpan melalui integrasi Google Drive.
- Sistem menyediakan dashboard, transaksi, buku besar, laporan keuangan, import/export Excel, export PDF, laporan per unit usaha, dan penutupan periode.

### Teknologi utama

- Frontend: React, Vite, React Router, Axios, Tailwind CSS, Recharts.
- Backend: Python, FastAPI, Uvicorn, PostgreSQL, SQLAlchemy Async, Pydantic.
- Dokumen: OpenPyXL untuk Excel serta ReportLab/pypdf untuk PDF.
- Keamanan: HttpOnly cookie, JWT, password hashing, validasi session, dan validasi role di backend.

## Landasan dan Prinsip Akuntansi

Sistem ini **berpedoman kepada Kepmendesa PDTT No. 136 Tahun 2022** tentang petunjuk teknis penyusunan laporan keuangan BUM Desa. Struktur akun, klasifikasi kategori, subkategori, saldo normal, jurnal, buku besar, dan laporan harus dipelihara agar tetap selaras dengan pedoman tersebut.

Kepmendesa PDTT No. 136 Tahun 2022 menjadi acuan utama dalam:

- Pengelompokan aset, kewajiban, ekuitas, pendapatan, dan beban.
- Penyusunan Chart of Accounts (COA).
- Pencatatan transaksi berpasangan debit dan kredit.
- Penyusunan laporan posisi keuangan/neraca.
- Penyusunan laporan laba rugi.
- Penyusunan laporan arus kas.
- Penyusunan laporan perubahan ekuitas.
- Penyusunan Catatan atas Laporan Keuangan (CALK).
- Penyusunan buku besar dan laporan konsolidasi.

Perubahan master data tidak boleh mengubah arti kategori atau saldo normal tanpa pemeriksaan dampaknya terhadap logika perhitungan laporan.

## Unit Usaha

Konfigurasi terbaru bersumber dari `data/COA-7-GRUP-9265c7.xlsx` dan di-seed melalui `backend/seed_data.py`.

| Kode | Nama unit usaha |
|---|---|
| `UU01` | Pembibitan Domba Garut |
| `UU02` | Peternakan Ikan Air Tawar Sistem Bioflok |
| `UU03` | Sewa Kendaraan Angkutan Barang |
| `UU04` | Karya Raharja Sinergi Digital (KRSD) |
| `UU05` | Toko Offline BUMDES |
| `UU06` | Toko Online BUMDES |

Selain enam unit usaha, terdapat grup `BUMDES` untuk pencatatan pusat dan konsolidasi.

## COA, Kategori, dan Subkategori Valid

Seed terbaru berisi **142 akun** dalam 7 grup: `BUMDES`, `UU01`, `UU02`, `UU03`, `UU04`, `UU05`, dan `UU06`.

Format setiap akun:

```text
(kode, nama, kategori, subkategori, saldo_normal, grup)
```

### Kategori dan subkategori

Nilai berikut adalah nilai valid yang digunakan untuk validasi akun, import transaksi, laporan, dan pemetaan saldo normal.

| Kategori | Subkategori valid |
|---|---|
| `aset` | `kas_bank`, `aset_lancar`, `aset_tetap` |
| `kewajiban` | `kewajiban_jangka_pendek` |
| `ekuitas` | `modal_desa`, `modal_masyarakat`, `bagi_hasil_desa`, `bagi_hasil_masyarakat`, `saldo_laba`, `ikhtisar_laba_rugi` |
| `pendapatan` | `pendapatan_operasional`, `pendapatan_non_operasional` |
| `beban` | `beban_administrasi`, `beban_operasional`, `beban_lain_lain` |

### Distribusi COA berdasarkan grup

| Grup | Jumlah akun | Keterangan |
|---|---:|---|
| `BUMDES` | 39 | Akun pusat dan konsolidasi |
| `UU01` | 17 | Pembibitan Domba Garut |
| `UU02` | 17 | Peternakan Ikan Air Tawar Sistem Bioflok |
| `UU03` | 17 | Sewa Kendaraan Angkutan Barang |
| `UU04` | 18 | Karya Raharja Sinergi Digital (KRSD) |
| `UU05` | 17 | Toko Offline BUMDES |
| `UU06` | 17 | Toko Online BUMDES |

### Struktur kode COA pusat

| Kelompok kode | Kategori/subkategori | Cakupan |
|---|---|---|
| `1.1.*`, `1.2.*` | `aset` / `kas_bank`, `aset_lancar` | Kas, bank, piutang, dan penyertaan modal kerja |
| `1.3.*`, `1.4.*`, `1.5.*` | `aset` / `aset_tetap` | Tanah, kendaraan, peralatan, gedung, aset biologis, aset tak berwujud, dan akumulasi penyusutan |
| `2.1.*` | `kewajiban` / `kewajiban_jangka_pendek` | Utang usaha dan utang bagi hasil |
| `3.1.*` | `ekuitas` / `modal_desa`, `modal_masyarakat` | Penyertaan modal |
| `3.2.*`, `3.3.*`, `3.9.*` | `ekuitas` / bagi hasil, saldo laba, ikhtisar laba rugi | Distribusi hasil usaha, saldo laba, dan ikhtisar laba rugi |
| `4.1.*`, `4.2.*` | `pendapatan` | Pendapatan usaha, pendapatan lain-lain, dan bunga bank |
| `6.1.*`, `6.2.*`, `6.3.*` | `beban` | Beban administrasi, operasional, admin bank, dan pajak bunga bank |

Akun unit `UU01`–`UU06` mengikuti struktur yang konsisten untuk kas/bank, piutang, utang, modal, bagi hasil, saldo laba, ikhtisar laba rugi, pendapatan, dan beban. `UU04` memiliki akun penyertaan modal kerja sesuai karakteristik usahanya.

Akun antar-unit dibedakan dengan kombinasi **kode akun dan grup**. Saldo normal secara umum adalah `debit` untuk aset dan beban, serta `kredit` untuk kewajiban, pendapatan, dan modal sesuai konfigurasi seed terbaru.

Sumber kebenaran lengkap 142 akun berada di `backend/seed_data.py`.

## Workflow Sistem

### Workflow umum

```text
Pengguna berwenang
        │
        ├── Login dan validasi role
        │
        ├── Memilih unit usaha, akun, jenis transaksi, tanggal, dan nominal
        │
        ├── Mengisi transaksi dan mengunggah bukti bila diperlukan
        ▼
Frontend React/Vite
        │  HTTP API + credentialed cookie
        ▼
Backend FastAPI
        │  Validasi session, role, format, COA, dan relasi master data
        ▼
PostgreSQL
        │
        ├── Jurnal transaksi
        ├── Buku besar
        ├── Perhitungan laporan
        └── Metadata bukti transaksi
        ▼
Dashboard, laporan, PDF, Excel, dan laporan konsolidasi
```

### Workflow login

```text
POST /api/auth/login
        ↓
Validasi username dan password
        ↓
Session/JWT disimpan sebagai HttpOnly cookie
        ↓
GET /api/auth/me
        ↓
Frontend menampilkan halaman dan aksi sesuai role
```

### Workflow transaksi

1. Pengguna berwenang memilih unit usaha dan mengisi detail transaksi.
2. Pengguna memilih akun debit dan kredit dari COA yang valid.
3. Backend memvalidasi session, role, kategori, subkategori, saldo normal, tanggal, nominal, dan relasi unit usaha.
4. Transaksi disimpan sebagai pencatatan berpasangan debit-kredit.
5. Bukti transaksi dapat diunggah dan diverifikasi.
6. Transaksi masuk ke buku besar dan perhitungan laporan sesuai periode serta unit usaha.
7. Data dapat difilter, diverifikasi, diekspor, atau digunakan dalam laporan konsolidasi oleh role yang berwenang.

### Workflow pelaporan

1. Sistem mengambil transaksi berdasarkan periode, unit usaha, akun, dan status yang dipilih.
2. Sistem mengelompokkan saldo berdasarkan kategori dan subkategori COA.
3. Sistem menghitung laporan laba rugi, neraca, arus kas, perubahan ekuitas, CALK, dan buku besar.
4. Sistem dapat menampilkan laporan per unit usaha atau laporan konsolidasi BUMDES.
5. Periode yang telah ditutup tidak boleh menerima perubahan tanpa kewenangan yang sesuai.

### Workflow import dan export

```text
Template Excel
      ↓
Validasi kolom, unit, akun, kategori, subkategori, tanggal, dan nominal
      ↓
Preview/error per baris
      ↓
Import batch ke database
      ↓
Buku besar dan laporan diperbarui
      ↓
Export Excel atau PDF jika diperlukan
```

### Workflow bukti transaksi

```text
Transaksi dibuat
      ↓
Bukti diunggah
      ↓
File disimpan pada Google Drive bila terkonfigurasi
      ↓
Metadata bukti disimpan pada transaksi
      ↓
Pengguna berwenang melakukan verifikasi atau penghapusan
```

### Workflow penutupan periode

```text
Periksa kelengkapan transaksi dan bukti
      ↓
Periksa keseimbangan debit-kredit
      ↓
Tinjau laporan periode
      ↓
Tutup periode
      ↓
Cegah perubahan tanpa kewenangan khusus
```

## Hak Akses Role

| Role | Akses utama |
|---|---|
| `admin` | Manajemen pengguna dan konfigurasi administrasi |
| `direktur` | Dashboard, pengawasan, dan laporan konsolidasi |
| `bendahara` | Transaksi, bukti transaksi, kas, dan laporan keuangan |
| `pengelola` | Transaksi dan data unit usaha yang menjadi tanggung jawabnya |
| `pengawas` | Peninjauan transaksi, bukti, dan laporan |
| `penasihat` | Akses baca untuk pengawasan pemerintahan desa |

Role divalidasi di backend. Pembatasan frontend bukan satu-satunya mekanisme keamanan.

## Sumber Kebenaran Konfigurasi

- Pedoman akuntansi: **Kepmendesa PDTT No. 136 Tahun 2022**.
- Data COA terbaru: `data/COA-7-GRUP-9265c7.xlsx`.
- Seed aplikasi: `backend/seed_data.py`.
- Validasi dan proses seed: `backend/startup.py`.

Panduan instalasi developer tersedia terpisah pada `PANDUAN-INSTALASI.md`. Panduan operasional seluruh role tersedia pada `PANDUAN-PENGGUNAAN.md`.

Perubahan pada COA, kategori, subkategori, saldo normal, unit usaha, atau workflow wajib diperiksa dampaknya terhadap jurnal dan logika perhitungan laporan sebelum diterapkan.
