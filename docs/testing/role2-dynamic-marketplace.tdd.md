# Role 2 Dynamic Marketplace — TDD Evidence

Tanggal verifikasi: 2026-09-08

## Tahap 2 — Counter quantity dan endpoint progress

### RED

Test contract `tests/unit/api-batch-progress.test.ts` ditulis sebelum route
progress tersedia dan gagal dengan `Cannot find package .../progress/route`.

### GREEN

Counter Redis kini memakai `INCRBY` sesuai quantity pendaftaran. Jika insert
Supabase gagal, rollback memakai delta negatif yang sama; counter yang hilang
dapat direkonsiliasi dari baris `registered` dan `pending_payment` memakai
service-role client lalu di-hydrate kembali ke Redis.

```text
npm test -- tests/unit/registration-counter.test.ts tests/unit/api-registrations.test.ts tests/unit/api-batch-progress.test.ts
Test Files  3 passed (3)
Tests       36 passed (36)
```

Lint file terkait juga lulus tanpa error.

## Kontrak yang dijamin

| Perilaku | Bukti |
|---|---|
| Counter bertambah sebesar quantity, bukan jumlah baris | `registration-counter.test.ts`, `api-registrations.test.ts` |
| Rollback insert gagal memakai quantity yang sama | `api-registrations.test.ts` |
| ID batch invalid ditolak 400 | `api-batch-progress.test.ts` |
| Batch hilang atau belum published tidak bocor 404 | `api-batch-progress.test.ts` |
| Redis down fail-closed 503 | `api-batch-progress.test.ts` |
| Progress mengembalikan server time, tier terurut, dan `tierProgress` | `api-batch-progress.test.ts` |
| Cache miss direkonsiliasi dari status live yang relevan | `api-batch-progress.test.ts` |

## Keputusan keamanan dan bisnis

- Endpoint progress hanya membaca batch berstatus `published`.
- Fallback agregasi memakai service-role client agar RLS tidak membuka baris
  registrasi UMKM lain; respons hanya mengandung total, bukan data per UMKM.
- `max_volume` tetap menjadi validasi quantity per pendaftaran. Tidak ada
  penolakan berdasarkan total kumulatif, karena PRD menetapkan tier sebagai
  ambang harga dan order tetap berjalan dengan fallback Tier 1 saat cutoff.
- Tidak ada cron atau job latar belakang; rekonsiliasi dilakukan on-demand saat
  cache Redis kosong.
