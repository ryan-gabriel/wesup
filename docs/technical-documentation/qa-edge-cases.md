# QA Plan – Edge Case Analysis
**Tim:** WeSUP | **Modul:** QA & Dokumentasi Teknis
**Tujuan:** Daftar skenario khusus (edge case) hasil bedah PRD, untuk diuji ketat di tahap QA menjelang deadline pengumpulan karya.

---

## A. Registrasi & Verifikasi Supplier (IAM)

| # | Skenario Edge Case | Expected Behavior |
|---|---|---|
| A1 | Supplier upload foto lokasi usaha > 10MB (sebelum dikompresi ke WebP) | Ditolak sebelum proses kompresi, beri feedback jelas |
| A2 | Admin belum sempat approve tapi Supplier sudah coba akses endpoint create-batch | Endpoint harus reject (403) karena status masih Pending |
| A3 | Nama atau alamat tempat usaha yang didaftarkan tidak konsisten dengan foto lokasi saat ditinjau Admin, Supplier ditolak lalu daftar ulang — apakah histori penolakan sebelumnya tersimpan? | Perlu log alasan reject sebelumnya (audit trail) |
| A4 | Dua Supplier berbeda mendaftar dengan alamat tempat usaha yang identik (karena tidak ada lagi validasi NIK sebagai pembeda unik) | Perlu didefinisikan: apakah sistem butuh validasi alternatif untuk mencegah akun duplikat/fiktif, mengingat NIK check sudah dihapus |

## B. Timeline & Tier Diskon (Catalog & Campaign)

| # | Skenario Edge Case | Expected Behavior |
|---|---|---|
| B1 | Supplier input timeline tidak linear (misal Payment Window mulai sebelum Waktu Tutup Pendaftaran) | Ditolak (HTTP 400) — Time-Travel Validation |
| B2 | Tier 2 (kuota lebih besar) harganya lebih mahal dari Tier 1 | Ditolak — Tier Inversion Prevention |
| B3 | Rentang kuota antar tier saling overlap (misal Tier 1: 0-50, Tier 2: 40-100) | Ditolak — Overlap Prevention |
| B4 | Supplier coba edit lokasi pin map setelah UMKM pertama mendaftar | Form lokasi ter-lock permanen, harus buat batch baru |
| B5 | Supplier coba edit skema tier setelah pendaftar pertama join | Ditolak — tier locked |
| B6 | Volume kumulatif saat cutoff tidak mencapai tier manapun | Otomatis fallback ke Tier 1 (harga dasar), bukan cancel |
| B7 | Recurring post: Supplier tidak konfirmasi review dalam batas waktu H-1 | Sistem default aman → batal tayang (bukan tayang otomatis) |
| B8 | Supplier menghapus katalog/penawaran yang **sudah memiliki pendaftar UMKM** | Sistem wajib mengirim notifikasi ke seluruh UMKM terdaftar bahwa katalog dihapus (fitur baru — sebelumnya penghapusan katalog tidak diizinkan sama sekali) |
| B9 | Supplier menghapus katalog yang belum ada pendaftar sama sekali | Dihapus langsung tanpa perlu notifikasi (tidak ada UMKM terdampak) |
| B10 | Katalog dihapus di tengah Payment Window (sudah ada UMKM yang bayar) | Perlu didefinisikan: apakah penghapusan otomatis memicu alur refund seperti Takedown Admin, atau ditolak sistem selama masih ada pembayaran aktif |

## C. Race Condition & Concurrency (Redis/Gatekeeper) — Prioritas Tinggi

| # | Skenario Edge Case | Expected Behavior |
|---|---|---|
| C1 | Ratusan UMKM klik "Daftar" bersamaan mendekati waktu cutoff (skenario FOMO) | Atomic Increment Redis harus konsisten, tidak ada race condition pada counter |
| C2 | Dua request API bersamaan memicu evaluasi cutoff/lock harga di detik yang sama | Distributed Lock (SETNX) — hanya 1 request yang eksekusi migrasi, lainnya jadi reader |
| C3 | Request pendaftaran masuk tepat di milidetik waktu tutup (boundary case) | Perlu didefinisikan: apakah "tutup" inklusif atau eksklusif? Harus konsisten |
| C4 | Tidak ada aktivitas user sama sekali selama masa transisi (tutup pendaftaran → payment window) lalu tiba-tiba banyak request masuk bersamaan saat window dibuka | Rekonsiliasi lazy evaluation + distributed lock harus tetap aman dari duplikasi eksekusi |

## D. Payment Window & Webhook Midtrans

| # | Skenario Edge Case | Expected Behavior |
|---|---|---|
| D1 | UMKM akses endpoint generate QRIS sebelum Payment Window dibuka | Ditolak HTTP 403 (Gatekeeper) |
| D2 | UMKM akses endpoint bayar setelah Payment Window lewat, tapi belum sempat kena rekonsiliasi | Ditolak, masuk kandidat Hit and Run |
| D3 | **Webhook Midtrans delay** — UMKM sudah bayar real tapi callback belum masuk saat Batas Akhir Payment Window tercapai | Gatekeeper wajib fetch status manual ke Midtrans dulu sebelum eksekusi sanksi (bukan langsung suspend) |
| D4 | Webhook masuk dobel (retry dari Midtrans) untuk transaksi yang sama | Idempotency check — status tidak boleh berubah dua kali / double count |
| D5 | UMKM buka halaman payment, jam device di-manipulasi (dimajukan/dimundurkan) | Countdown pakai Server Timestamp, bukan jam lokal client |
| D6 | Koneksi UMKM putus di tengah proses generate QRIS | Toast/Snackbar error, transaksi tidak boleh nyangkut di status ambigu |

## E. Hit and Run & Sanksi Progresif

| # | Skenario Edge Case | Expected Behavior |
|---|---|---|
| E1 | UMKM kena pelanggaran ke-2, suspend 7 hari dihitung dari waktu skrip jalan (bukan dari batas akhir Payment Window) | Salah — harus dihitung retrospektif dari timestamp absolut Batas Akhir Payment Window |
| E2 | UMKM yang sedang suspend temporary (7 hari) coba akses/join batch baru | Akses endpoint Order/Join harus diblokir oleh Auth |
| E3 | UMKM kena pelanggaran ke-3 di tengah proses lain (misal komplain aktif) | Perlu didefinisikan prioritas: apakah suspend permanen tetap berlaku walau ada dispute berjalan? |

## F. Fulfillment & QR/PIN

| # | Skenario Edge Case | Expected Behavior |
|---|---|---|
| F1 | Supplier scan QR yang sudah pernah dipakai (replay) | Ditolak, status sudah "Sudah Diambil" |
| F2 | Supplier input PIN 4-digit salah berkali-kali | Perlu rate limiting/lockout sementara untuk cegah brute force PIN |
| F3 | Supplier tekan Force Majeure setelah UMKM sudah scan QR (barang sudah diambil) | Harus ditolak — Force Majeure hanya valid sebelum serah-terima |
| F4 | UMKM datang tepat di menit ke-720 (jam ke-12) dari Estimasi Ready | Perlu definisi tegas: boundary inklusif atau tidak |

## G. Escrow & Sengketa — Paling Krusial

| # | Skenario Edge Case | Expected Behavior |
|---|---|---|
| G1 | UMKM komplain tepat di jam ke-25 (1 menit setelah batas 24 jam) | Ditolak permanen — dana sudah cair on-demand ke Supplier |
| G2 | UMKM komplain di jam ke-23:59, tapi di jam itu juga ada query lain yang trigger auto-release lebih dulu (race condition antara komplain vs auto-release) | Harus ada mekanisme lock: begin dispute-check dulu sebelum eksekusi release |
| G3 | UMKM submit komplain tanpa foto bukti (upload gagal/kosong) | Ditolak — validasi wajib ada foto |
| G4 | Foto bukti sengketa > 10MB, atau gagal dikonversi ke format WebP di sisi frontend | Ditolak sebelum diproses; sistem tidak menerima format mentah selain hasil kompresi WebP |
| G5 | Tidak ada aktivitas API sama sekali setelah 24 jam lewat (tidak ada yang trigger lazy evaluation) — dana kapan cair? | Baru cair saat ada request relevan berikutnya (misal Supplier buka dashboard) — perlu dicek apakah delay ini acceptable secara bisnis |
| G6 | Admin memutuskan sengketa, tapi di saat bersamaan No-Show timer juga jalan (dua status bertabrakan) | Perlu prioritas state: begitu komplain masuk, status No-Show tidak relevan lagi |
| G7 | UMKM No-Show tapi ternyata dia sebenarnya sudah bayar dan datang, hanya gagal scan QR (device error) | Tidak ada mekanisme override manual? Perlu jalur eskalasi ke Admin |

## H. Refund Manual

| # | Skenario Edge Case | Expected Behavior |
|---|---|---|
| H1 | UMKM tidak pernah isi rekening refund setelah status disetujui | Perlu status "Menunggu Input Rekening" dan reminder |
| H2 | Admin sudah transfer manual tapi lupa update status "Refund Selesai" | Data tidak sinkron — perlu audit log wajib |
| H3 | Takedown terjadi pada batch yang sebagian UMKM sudah bayar, sebagian belum | Sistem harus refund yang sudah bayar, batalkan tagihan yang belum |

## I. Admin & Audit Log

| # | Skenario Edge Case | Expected Behavior |
|---|---|---|
| I1 | Penulisan audit log ke DB gagal saat Admin eksekusi aksi kritikal (takedown/refund) | Aksi harus di-rollback total, bukan tetap jalan tanpa log |
| I2 | Dua Admin mengeksekusi keputusan sengketa yang sama secara bersamaan | Perlu lock agar tidak dobel eksekusi |

## J. Marketplace & Discovery (Pencarian UMKM)

| # | Skenario Edge Case | Expected Behavior |
|---|---|---|
| J1 | UMKM mengetik cepat di kolom pencarian (banyak keystroke dalam waktu singkat) | Debouncer harus menahan query hingga user berhenti mengetik sejenak, agar tidak membebani backend dengan request per-karakter |
| J2 | UMKM share link penawaran ke WhatsApp | Link **tidak lagi** membawa parameter referal unik (fitur referral tracking dihapus dari PRD) — cukup link biasa ke halaman penawaran |
| J3 | Filter radius/kategori dikombinasikan dengan pencarian teks sekaligus | Query gabungan tetap harus melalui rate limiting/fetching limit yang sama |

## K. Perubahan Global (Lintas Modul)

| # | Skenario Edge Case | Expected Behavior |
|---|---|---|
| K1 | Gambar hasil kompresi WebP gagal ter-generate di browser lama/tidak didukung | Perlu fallback format (misal JPEG) atau pesan error yang jelas ke user, bukan silent fail |
| K2 | Notifikasi terjadwal (misal reminder H-1 recurring post) tidak berjalan karena GitHub Actions gagal trigger (quota habis/downtime) | Perlu skrip manual sebagai fallback — terutama disiapkan untuk skenario presentasi/demo agar tidak bergantung penuh pada automasi eksternal |

---

**Total: 11 kategori, ~44 edge case.**
Dokumen ini menjadi lampiran/acuan untuk tahap QA sebelum deadline pengumpulan karya (25 Oktober 2026).
