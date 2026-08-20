# Planning UI Admin – Kebutuhan Data
**Tim:** WeSUP | **Modul:** QA & Dokumentasi Teknis
**Tujuan:** Pemetaan kebutuhan data untuk panel Admin (KYC Queue & Audit Log), sebagai acuan bagi tim frontend/backend saat implementasi.

---

## 3.1 Tabel Antrean Verifikasi Supplier (KYC Queue)

**Referensi PRD:** 2.3.1 Verifikasi & Antrean Supplier

### Kebutuhan Kolom Tabel

| Kolom | Sumber Data | Keterangan |
|---|---|---|
| Nama Supplier | `suppliers.name` | |
| Email | `suppliers.email` | |
| Tanggal Daftar | `suppliers.created_at` | untuk urutkan antrean (FIFO) |
| Status | `suppliers.verification_status` | enum: `pending` / `approved` / `rejected` |
| Foto Lokasi Usaha | `suppliers.location_photo_url` | thumbnail (format WebP), klik untuk full-size |
| Alamat Tempat Usaha | `suppliers.address` | ditinjau bersama foto lokasi untuk verifikasi keaslian usaha |
| Lokasi (Pin Peta) | `suppliers.lat`, `suppliers.lng` | idealnya render mini-map |
| Aksi | — | tombol Approve / Reject |

> **Perubahan PRD:** Kolom Foto KTP dan NIK **dihapus** dari alur verifikasi. Verifikasi Admin kini hanya berdasarkan Nama, Email, dan keaslian Tempat Usaha (foto lokasi + alamat) — bukan lagi dokumen identitas KTP.

### Fitur Pendukung Wajib (ref. PRD 2.4)

- Pagination & fetching limit (batasi query, jangan tarik semua sekaligus)
- Empty state jika antrean kosong
- Skeleton loading saat fetch data
- Saat Reject, wajib ada modal input alasan (teks) → tersimpan sebagai log, ditampilkan lagi ke Supplier

### Detail View (klik 1 baris)

- Semua data di atas + histori penolakan sebelumnya (jika re-submit)
- Tombol Approve/Reject di halaman detail juga (tidak hanya di tabel)

---

## 3.2 Tabel Audit Log Admin (Activity History)

**Referensi PRD:** 2.3.6 Catatan Log Aktivitas Admin

### Kebutuhan Kolom Tabel

| Kolom | Sumber Data | Keterangan |
|---|---|---|
| Timestamp | `audit_logs.created_at` | urutkan descending (terbaru dulu) |
| ID Admin | `audit_logs.admin_id` → join ke nama admin | |
| Jenis Aksi | `audit_logs.action_type` | enum: `takedown`, `dispute_decision`, `kyc_approval`, `kyc_rejection`, `manual_suspend`, `refund_confirmation` |
| ID Target | `audit_logs.target_id` | ID transaksi/akun yang kena aksi |
| Detail/Alasan | `audit_logs.reason` | teks alasan (wajib untuk takedown & reject) |
| Status | — | append-only, read-only (tidak ada aksi edit/hapus di UI) |

### Catatan Penting untuk Tim Backend

- Tabel ini **append-only** — UI tidak boleh render tombol edit/delete sama sekali
- Filter yang dibutuhkan: by jenis aksi, by rentang tanggal, by ID admin
- Karena berpotensi jadi tabel besar → wajib pagination ketat

---

## 3.3 Kebutuhan Data Tambahan (Turunan dari Role Admin Lain)

Untuk melengkapi cakupan panel Admin secara menyeluruh (ref. PRD 2.3.3 & 2.3.4):

| Panel | Kolom Kunci | Catatan Khusus |
|---|---|---|
| Antrean Refund | ID transaksi, UMKM, jumlah, alasan trigger (takedown/force majeure/dispute), status (`menunggu refund`/`selesai`), rekening tujuan | Status harus diupdate manual jadi "Refund Selesai" |
| Panel Sengketa Escrow | Foto bukti UMKM, detail transaksi, timestamp consent lokasi, catatan klarifikasi | Dua tombol aksi mutlak: Rilis ke Supplier / Refund ke UMKM |

---

## 3.4 Catatan Perubahan Global (relevan untuk Admin Panel)

- **Format Gambar → WebP:** Seluruh gambar yang diunggah (foto lokasi usaha, foto produk, bukti sengketa) dikompresi di frontend menjadi format **WebP** sebelum dikirim ke server, agar beban backend lebih ringan. UI Admin (thumbnail preview) perlu memastikan browser rendering mendukung format ini.
- **Notifikasi via GitHub Actions (bukan cron berbayar):** Karena arsitektur awal menghindari cron/scheduled job untuk penghematan biaya serverless, khusus untuk kebutuhan notifikasi terjadwal (misal reminder H-1 recurring post), tim menggunakan **GitHub Actions** sebagai scheduled trigger gratis. Untuk keperluan presentasi/demo, disiapkan juga skrip manual sebagai fallback jika GitHub Actions tidak sempat di-setup penuh.
