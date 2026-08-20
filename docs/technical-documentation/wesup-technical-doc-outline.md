# Kerangka Dokumen Teknis – WeSUP
**Nama File Submission:** `ElWinnare_UniversitasPendidikanIndonesia_WeSUP.pdf`
**Tujuan:** Kerangka Dokumentasi Teknis PDF sesuai format Guidebook Fullstack Web Development Competition INSEVENT 2026.

> Catatan: dokumen ini adalah draft outline + isi awal (Pendahuluan & Latar Belakang).
> Bagian lain (Tech Stack, Arsitektur, Fitur, Instalasi) diisi menyusul oleh anggota tim terkait.

---

## Struktur Lengkap Dokumen

```
JUDUL: WeSUP – Platform Group-Buying Bahan Baku untuk UMKM Berbasis Self-Pickup
Tim: ElWinnare | Universitas Pendidikan Indonesia | Subtema: SDG 8

1. PENDAHULUAN
   1.1 Latar Belakang
   1.2 Rumusan Masalah
   1.3 Tujuan Pengembangan
   1.4 Ruang Lingkup (Scope MVP)

2. IDENTITAS TIM
   - Nama & NIM seluruh anggota
   - Pembagian peran/role

3. TECH STACK
   - Tabel layer teknologi (Frontend/Backend, DB, Cache, Payment, dst)
   - Alasan pemilihan tiap teknologi

4. ARSITEKTUR SISTEM
   4.1 Diagram ERD
   4.2 Flowchart Alur Kerja Utama
   4.3 Diagram Arsitektur Sistem (high-level: Next.js – Supabase – Redis – Midtrans)
   4.4 Penjelasan Mekanisme Kunci (API Gatekeeper, Lazy Evaluation, Escrow)

5. FITUR & MODUL SISTEM
   5.1 Modul per Role (Supplier, UMKM, Admin)
   5.2 Fitur Lintas Peran (Cross-Functional)

6. PANDUAN INSTALASI & DEPLOYMENT LOKAL
   6.1 Requirement (Node.js, env variable, dsb)
   6.2 Langkah Instalasi
   6.3 Langkah Menjalankan Secara Lokal
   6.4 Link Deployment Live

7. SURAT PERNYATAAN ORISINALITAS KARYA
   (Sesuai template panitia)

LAMPIRAN
   - Daftar Edge Case / QA Plan (lihat sprint1-dhafin-qa-edge-cases.md)
```

---

## 1. Pendahuluan

### 1.1 Latar Belakang

UMKM di sektor kuliner dan produksi rumahan umumnya menghadapi tantangan klasik dalam pengadaan bahan baku, yaitu harga beli yang tidak kompetitif akibat volume pembelian yang kecil dibandingkan pelaku usaha skala besar. Ketika UMKM membeli bahan baku secara individual, mereka tidak memiliki daya tawar untuk mendapatkan harga grosir, sehingga margin keuntungan menjadi tertekan.

Di sisi lain, model bisnis pembelian kolektif (group-buying) yang sudah ada di pasar umumnya masih bergantung pada sistem distribusi jarak jauh (last-mile delivery), yang menimbulkan kerumitan logistik tersendiri: biaya pengiriman tambahan, risiko kerusakan barang selama distribusi, serta potensi sengketa antara pembeli dan penjual terkait kondisi barang saat diterima.

WeSUP hadir sebagai solusi yang menyederhanakan permasalahan ini melalui pendekatan **self-pickup**, di mana UMKM secara kolektif mendaftar untuk membeli bahan baku dalam volume besar guna mendapatkan harga bertingkat (*tiered pricing*), namun pengambilan barang dilakukan secara langsung di titik kumpul Supplier. Pendekatan ini menghilangkan kompleksitas last-mile logistics sekaligus memungkinkan verifikasi fisik barang saat serah-terima, sehingga sengketa dapat diminimalisir sejak awal.

Untuk menjamin keamanan transaksi antara kedua belah pihak, WeSUP mengimplementasikan mekanisme **Escrow 24 jam**, sistem penguncian harga berbasis waktu absolut (*API Gatekeeper*), serta arsitektur *Lazy Evaluation* yang dirancang efisien untuk lingkungan serverless — menjadikan WeSUP tidak hanya solutif secara bisnis, tetapi juga matang secara teknis untuk diimplementasikan dalam skala nyata.

### 1.2 Rumusan Masalah

Berdasarkan latar belakang di atas, dapat dirumuskan permasalahan sebagai berikut:

1. Bagaimana merancang sistem yang memungkinkan UMKM mendapatkan harga bahan baku lebih kompetitif tanpa memerlukan modal besar untuk membeli dalam volume tinggi secara individual?
2. Bagaimana meminimalisir risiko sengketa fisik (barang rusak/cacat) dan kerugian finansial (selisih harga, dana lebih) dalam transaksi group-buying tanpa melibatkan pihak logistik pihak ketiga?
3. Bagaimana merancang arsitektur backend yang efisien secara biaya (serverless-friendly) namun tetap mampu menangani proses time-sensitive seperti penutupan pendaftaran, jendela pembayaran, dan pencairan dana escrow secara akurat?

### 1.3 Tujuan Pengembangan

1. Membangun platform yang memfasilitasi UMKM melakukan pembelian bahan baku secara kolektif dengan skema harga tier berbasis volume.
2. Menyediakan mekanisme keamanan transaksi dua arah (Escrow, audit trail consent lokasi, sistem reputasi) yang melindungi kepentingan Supplier maupun UMKM.
3. Mengimplementasikan arsitektur backend berbasis *event-driven & on-demand evaluation* yang optimal untuk infrastruktur serverless (Vercel), tanpa bergantung pada scheduled job/cron.

### 1.4 Ruang Lingkup (Scope MVP)

Pengembangan WeSUP pada tahap MVP dibatasi dengan ketentuan berikut:

- Cakupan wilayah operasional hanya di **Bandung**, untuk memungkinkan verifikasi fisik Supplier secara manual oleh Admin dan menghindari kompleksitas logistik lintas kota.
- Validasi keaslian Supplier (KYC) dilakukan secara manual oleh Admin melalui kunjungan lapangan, sebagai pengganti sementara integrasi API pemerintah (OSS/NIB) yang direncanakan pada tahap pengembangan selanjutnya.
- Proses refund dieksekusi secara manual oleh Admin, mengikuti keterbatasan fitur auto-refund pada QRIS Midtrans Sandbox.
- Sistem notifikasi utama menggunakan WhatsApp API (Fonnte Trial) dengan In-App Notification Center sebagai fallback jika terjadi rate limit atau kegagalan pengiriman pihak ketiga.

---

## 2. Identitas Tim

**Nama Tim:** ElWinnare
**Asal Instansi:** Universitas Pendidikan Indonesia
**Subtema:** SDG 8 – Digital Innovation for Economic Challenges

| Nama | NIM | Role |
|---|---|---|
| Muhammad Rafif Zharif | [TODO: isi NIM] | [TODO: isi role] |
| Dhafin Salman | [TODO: isi NIM] | [TODO: isi role] |
| Ryan Gabriel Siringoringo | [TODO: isi NIM] | [TODO: isi role] |
| Muhamad Yanuar Alfaridzi | [TODO: isi NIM] | [TODO: isi role] |
| Muhammad Nashirul Haq Resa | [TODO: isi NIM] | [TODO: isi role] |

> NIM dan role masing-masing anggota masih perlu dilengkapi sebelum dokumen di-final-kan.

---

## 3. Tech Stack

| Layer | Teknologi | Peran dalam Sistem |
|---|---|---|
| Repository | Monorepository (single Next.js project) | Frontend & backend dalam satu codebase, satu deployment target |
| Frontend & Backend | Next.js (App Router + API Routes) | UI rendering + business logic (batch, tier, refund, suspend, webhook listener) dalam satu framework |
| Database & Object Storage | Supabase (PostgreSQL + Storage + Auth) | Data relasional terpusat + penyimpanan foto (format WebP hasil kompresi frontend) + manajemen otorisasi role-based |
| Cache & Atomic Operation | Redis (Upstash serverless-compatible) | Atomic counter volume tier, Distributed Lock (SETNX), cache progress bar tier real-time |
| Payment | QRIS via Midtrans Sandbox | Gerbang pembayaran untuk pengujian tanpa dokumen legal perusahaan |
| Notifikasi | Fonnte / WhatsApp API Trial & In-App UI | Peringatan batas waktu, pembukaan jendela pembayaran, fallback in-app |
| Scheduled Trigger (Notifikasi) | GitHub Actions (gratis) | Menjalankan skrip notifikasi terjadwal (misal reminder H-1 recurring post); skrip manual disiapkan sebagai fallback untuk keperluan presentasi/demo |
| Deployment | Vercel | Hosting Next.js app; Supabase & Upstash terhubung via environment variable |

**Alasan Pemilihan Arsitektur — Event-Driven Check (Lazy Evaluation):**

Alih-alih menggunakan polling terjadwal (cron/scheduled job), sistem melakukan pengecekan status *cutoff* secara langsung saat pengguna membuka halaman batch terkait. Jika waktu sudah melewati cutoff, barulah logic lock (penguncian harga/tier) di-trigger secara on-demand. Pendekatan ini lebih efisien secara biaya komputasi serverless dan sepenuhnya menghindari kompleksitas maintenance cron job, termasuk risiko job yang gagal jalan atau tumpang tindih eksekusi.

> **Catatan:** Prinsip *no-cron* ini berlaku untuk logika transaksi inti (cutoff, escrow, sanksi). Khusus untuk notifikasi terjadwal yang sifatnya non-kritikal (pengingat H-1), tim menggunakan GitHub Actions sebagai scheduled trigger gratis, dengan skrip manual sebagai cadangan saat demo/presentasi.

**Kompresi Gambar — Format WebP:**

Seluruh gambar yang diunggah pengguna (foto lokasi usaha, foto produk, bukti sengketa) dikompresi di sisi frontend menjadi format **WebP** sebelum dikirim ke server. Perubahan dari rencana awal (kompresi generik) ke WebP spesifik dipilih karena ukuran file WebP lebih kecil dibanding JPEG/PNG pada kualitas visual setara, sehingga beban pemrosesan dan penyimpanan di backend/Supabase Storage berkurang signifikan.

---

## 4. Arsitektur Sistem

> [TODO: dilengkapi oleh PIC arsitektur — Diagram ERD, Flowchart Alur Kerja Utama, Diagram Arsitektur Sistem, dan penjelasan mekanisme API Gatekeeper/Escrow]

## 5. Fitur & Modul Sistem

> [TODO: dilengkapi — breakdown fitur per role sesuai PRD]

## 6. Panduan Instalasi & Deployment Lokal

> [TODO: dilengkapi — requirement, langkah instalasi, environment variable yang dibutuhkan (tanpa value asli), langkah run lokal, link deployment live]

**Catatan environment variable (jangan commit value asli ke repo):**

```
NEXT_PUBLIC_SUPABASE_URL=<isi-dari-project-Supabase-masing-masing>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<isi-dari-project-Supabase-masing-masing>
SUPABASE_ACCESS_TOKEN=<opsional, khusus AI agent operasional Supabase, ambil dari akun masing-masing>
```

Value asli hanya boleh berada di `.env.local` (git-ignored). File `.env.example` di repo hanya memuat nama variabel tanpa isi rahasia.

## 7. Surat Pernyataan Orisinalitas Karya

> [TODO: gunakan template resmi dari panitia, lampirkan sebagai halaman terakhir dokumen]
