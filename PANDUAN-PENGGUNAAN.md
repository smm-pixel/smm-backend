# Panduan Penggunaan

Panduan ini berlaku untuk seluruh role pengguna Sistem Informasi Akuntansi dan Transparansi Keuangan BUMDes Karya Raharja.

## 1. Akses aplikasi

1. Buka alamat aplikasi.
2. Masuk melalui halaman login.
3. Masukkan username dan password.
4. Setelah berhasil, aplikasi menampilkan halaman sesuai role.
5. Gunakan menu profil untuk memeriksa data pengguna dan mengganti password.

Logout dilakukan melalui menu akun. Selalu logout setelah selesai menggunakan perangkat bersama.

## 2. Role dan akses

| Role | Penggunaan utama |
|---|---|
| `admin` | Manajemen pengguna dan konfigurasi administrasi. |
| `direktur` | Dashboard, pengawasan, dan laporan konsolidasi. |
| `bendahara` | Transaksi, bukti transaksi, kas, dan laporan keuangan. |
| `pengelola` | Transaksi dan data unit usaha yang menjadi tanggung jawabnya. |
| `pengawas` | Peninjauan transaksi, bukti, dan laporan. Akses hanya baca. |
| `penasihat` | Akses baca untuk pengawasan pemerintahan desa. |

Menu atau tombol yang tidak tersedia untuk role tertentu memang dibatasi oleh sistem. Backend juga memvalidasi role sehingga pembatasan tidak hanya bergantung pada tampilan frontend.

## 3. Dashboard

Dashboard digunakan untuk melihat ringkasan kondisi keuangan dan kinerja unit usaha.

Gunakan filter periode dan unit usaha jika tersedia. Periksa periode aktif sebelum mengambil kesimpulan dari angka dashboard.

## 4. Master data

Master data tersedia melalui menu berikut:

- **Chart of Accounts**: daftar akun dan klasifikasi akuntansi.
- **Unit Usaha**: daftar unit usaha dan informasinya.
- **Mitra**: data mitra usaha.
- **Jenis Transaksi**: klasifikasi transaksi yang digunakan saat pencatatan.

### Unit usaha terbaru

| Kode | Nama |
|---|---|
| `UU01` | Pembibitan Domba Garut |
| `UU02` | Peternakan Ikan Air Tawar Sistem Bioflok |
| `UU03` | Sewa Kendaraan Angkutan Barang |
| `UU04` | Karya Raharja Sinergi Digital (KRSD) |
| `UU05` | Toko Offline BUMDES |
| `UU06` | Toko Online BUMDES |

### Kategori akun valid

| Kategori | Subkategori |
|---|---|
| `aset` | `kas_bank`, `aset_lancar`, `aset_tetap` |
| `kewajiban` | `kewajiban_jangka_pendek` |
| `ekuitas` | `modal_desa`, `modal_masyarakat`, `bagi_hasil_desa`, `bagi_hasil_masyarakat`, `saldo_laba`, `ikhtisar_laba_rugi` |
| `pendapatan` | `pendapatan_operasional`, `pendapatan_non_operasional` |
| `beban` | `beban_administrasi`, `beban_operasional`, `beban_lain_lain` |

Gunakan akun yang sesuai dengan unit dan kategori transaksi. Jangan membuat akun duplikat jika akun yang diperlukan sudah tersedia.

## 5. Mencatat transaksi

1. Buka menu **Transaksi**.
2. Pilih **Tambah transaksi**.
3. Isi tanggal transaksi.
4. Pilih unit usaha atau BUMDES pusat.
5. Pilih jenis transaksi.
6. Pilih akun debit dan akun kredit.
7. Isi nominal dan keterangan.
8. Periksa bahwa jumlah debit dan kredit seimbang.
9. Simpan transaksi.

Gunakan keterangan yang jelas, misalnya nama mitra, tujuan pembayaran, nomor dokumen, atau periode transaksi.

Pengelola hanya dapat mengelola transaksi unit yang menjadi tanggung jawabnya. Role baca seperti pengawas dan penasihat tidak dapat mengubah transaksi.

## 6. Bukti transaksi

Untuk menambahkan bukti:

1. Buka detail transaksi.
2. Pilih aksi **Upload bukti**.
3. Pilih file yang relevan.
4. Pastikan file berhasil tersimpan.
5. Periksa status verifikasi bukti jika fitur tersebut tersedia.

Gunakan nama file yang mudah dicari, contohnya:

```text
2026-01-15-UU01-pembelian-pakan-001.pdf
```

Jangan mengunggah file yang berisi password, token, atau informasi yang tidak berhubungan dengan transaksi.

## 7. Import transaksi dari Excel

1. Unduh template transaksi dari halaman transaksi.
2. Jangan mengubah nama kolom template.
3. Isi satu baris untuk setiap transaksi.
4. Pastikan kode akun, unit usaha, tanggal, debit, dan kredit valid.
5. Pastikan nominal menggunakan angka yang benar.
6. Simpan file dalam format `.xlsx`.
7. Gunakan menu **Import** dan unggah file.
8. Baca hasil import dan perbaiki baris yang ditolak.

Simpan salinan file sebelum import. Hindari mengunggah file yang sama berulang kali karena dapat membuat pencatatan ganda.

## 8. Laporan

Menu laporan menyediakan:

- Laba rugi.
- Neraca.
- Arus kas.
- Perubahan ekuitas.
- CALK.
- Buku besar.
- Laporan konsolidasi.
- Laporan per unit usaha.

Alur yang disarankan:

1. Pilih periode.
2. Pilih unit usaha atau konsolidasi.
3. Periksa hasil laporan.
4. Buka buku besar untuk menelusuri saldo ke transaksi.
5. Export ke Excel atau PDF jika diperlukan.

Jika laporan tidak seimbang, periksa transaksi dengan debit/kredit tidak seimbang, akun yang salah, tanggal transaksi, dan unit usaha.

## 9. Export

- Gunakan **Export Excel** untuk pengolahan lanjutan.
- Gunakan **Export PDF** untuk dokumen laporan atau kebutuhan rapat.
- Pastikan filter periode dan unit usaha sudah benar sebelum export.
- Periksa file hasil export sebelum dibagikan.

## 10. Penutupan periode

Penutupan periode hanya boleh dilakukan setelah:

- Seluruh transaksi periode tersebut sudah dicatat.
- Bukti transaksi penting sudah tersedia.
- Saldo kas, bank, dan piutang sudah diperiksa.
- Laporan sudah ditinjau oleh pihak berwenang.
- Kesalahan transaksi sudah diperbaiki.

Penutupan periode dapat membatasi perubahan transaksi pada periode tersebut. Koordinasikan dengan direktur, bendahara, atau admin sebelum menjalankannya.

## 11. Pengelolaan pengguna

Fitur pengelolaan pengguna hanya tersedia untuk admin.

Admin bertanggung jawab untuk:

- Membuat pengguna.
- Menetapkan role.
- Menetapkan unit usaha untuk pengelola.
- Menonaktifkan akses pengguna yang tidak lagi bertugas.
- Mengarahkan pengguna untuk mengganti password awal.

Jangan berbagi satu akun dengan pengguna lain karena aktivitas sistem perlu dapat ditelusuri ke pengguna yang benar.

## 12. Praktik keamanan

- Jangan membagikan password.
- Gunakan password unik dan kuat.
- Logout dari perangkat bersama.
- Jangan mengubah URL atau mencoba melewati pembatasan akses.
- Laporkan aktivitas atau data yang mencurigakan kepada admin.
- Verifikasi kembali penerima dan nominal sebelum menyimpan transaksi.
- Simpan dokumen export pada lokasi yang aman.

## 13. Pemecahan masalah

### Tidak dapat login

Periksa username dan password, lalu hubungi admin jika akun terkunci atau belum aktif.

### Menu tidak tersedia

Kemungkinan menu tersebut tidak termasuk akses role Anda. Hubungi admin jika akses seharusnya tersedia.

### Transaksi ditolak

Periksa tanggal, unit usaha, akun, jenis transaksi, nominal, dan keseimbangan debit-kredit.

### Bukti gagal diunggah

Periksa ukuran dan format file, koneksi internet, serta status integrasi Google Drive. Hubungi admin jika masalah berlanjut.

### Laporan tidak sesuai

Periksa filter periode/unit, buku besar, dan transaksi sumber. Jangan mengubah master data untuk memperbaiki laporan tanpa persetujuan pihak yang berwenang.

---

Untuk instalasi, konfigurasi environment, dan deployment developer, lihat `PANDUAN-INSTALASI.md`.
