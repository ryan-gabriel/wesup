# Redis Atomic Counter & Cutoff Gatekeeper TDD Evidence

Tanggal verifikasi: 2026-08-31

## Scope

Implementasi tiga fitur modul Order (PRD 3.1/3.2):

1. **Redis Atomic Counter** — integrasi tabel Order (`registrations`) dengan counter atomik Redis (`INCR`) pada setiap klik "Daftar" UMKM untuk mencegah race condition.
2. **Volume-Limiting API (Gatekeeper)** — endpoint khusus untuk mengunci volume setelah `registration_closes_at` (cutoff), dengan fallback harga Tier 1.
3. **Distributed Lock** — endpoint cutoff memakai `SETNX` pada Redis (owner-token + Lua compare-and-delete + TTL) supaya hanya satu request konkuren yang mengeksekusi kunci harga; lainnya bertindak sebagai reader.

Tidak ada secret, password, atau kredensial yang dicatat dalam dokumen ini.

## RED/GREEN Evidence

### Task 1 — time-gatekeeper (validasi timestamp absolut)

RED: file `tests/unit/time-gatekeeper.test.ts` ditulis lebih dulu; `resolveTierForVolume` gagal pada batas tier saat implementasi awal (logika `break` salah):

```text
npm test -- tests/unit/time-gatekeeper.test.ts
Tests  1 failed ... selected the highest qualifying tier boundary (expected 2, received 1)
```

GREEN setelah perbaikan logika pemilihan tier:

```text
npm test -- tests/unit/time-gatekeeper.test.ts
Tests  11 passed (11)
```

### Task 2 — registration-counter (INCR + distributed lock)

RED: file `tests/unit/registration-counter.test.ts` ditulis lebih dulu (modul `lib/orders/registration-counter.ts` belum ada → `Cannot find module`).

GREEN:

```text
npm test -- tests/unit/registration-counter.test.ts
Test Files  1 passed (1)
Tests       8 passed (8)
```

### Task 3 — migration `cut_off_batch` + schema-contract

RED: `tests/migrations/cutoff-gatekeeper.test.ts` mengharuskan `cut_off_batch` didefinisikan, `security definer`, idempoten, fallback Tier 1, dan audit action baru — gagal sebelum migrasi ditulis.

GREEN (termasuk contract schema penuh 171 test tidak rusak):

```text
npm test -- tests/migrations/cutoff-gatekeeper.test.ts tests/migrations/schema.test.ts
Test Files  2 passed (2)
Tests       180 passed (180)
```

### Task 4 — `POST /api/registrations` (atomic register)

RED: `tests/unit/api-registrations.test.ts` — beberapa kasus awalnya gagal (default mock tiers/timeline null → 500) dan diperbaiki pada harness pengujian, bukan logika produksi.

GREEN:

```text
npm test -- tests/unit/api-registrations.test.ts
Test Files  1 passed (1)
Tests       10 passed (10)
```

### Task 5 — `POST /api/batches/[id]/cutoff` (distributed lock)

RED: `tests/unit/api-batch-cutoff.test.ts` ditulis lebih dulu (route belum ada).

GREEN:

```text
npm test -- tests/unit/api-batch-cutoff.test.ts
Test Files  1 passed (1)
Tests       5 passed (5)
```

### Keseluruhan (non-live) — hijau

```text
npx vitest run tests/unit tests/migrations
Test Files  23 passed (23)
Tests       431 passed (431)
```

Lint (hanya proyek, 0 error):

```text
npx eslint app/api/registrations/route.ts app/api/batches/[id]/cutoff/route.ts lib/orders/*.ts lib/rate-limit.ts types/database.ts tests/{unit,migrations}/...
(no output)
```

Build production Next.js (setelah `rm -rf .next` untuk membersihkan cache artefak):

```text
npm run build
✓ Compiled successfully
Route /api/registrations      (ƒ dynamic)
Route /api/batches/[id]/cutoff (ƒ dynamic)
```

## Test Specification

| # | What is guaranteed | Test file / case | Type | Result |
|---|--------------------|------------------|------|--------|
| 1 | Mendaftar hanya diizinkan di dalam jendela `opens ≤ now < closes` | `time-gatekeeper.test.ts` | unit | PASS |
| 2 | Ditolak sebelum buka, saat cutoff, dan batch non-published | `time-gatekeeper.test.ts` | unit | PASS |
| 3 | Resolusi tier harga dengan fallback Tier 1 jika min tier tak terpenuhi | `time-gatekeeper.test.ts` | unit | PASS |
| 4 | `INCR` atomik pada kunci per-batch `batch:<id>:count` | `registration-counter.test.ts` | unit | PASS |
| 5 | Lock `SETNX` + owner-token; penantang kedua ditolak | `registration-counter.test.ts` | unit | PASS |
| 6 | Release hanya oleh pemilik (Lua compare-and-delete) | `registration-counter.test.ts` | unit | PASS |
| 7 | Route registrasi memanggil INCR, upsert counter, insert registrasi | `api-registrations.test.ts` | unit | PASS |
| 8 | Route registrasi menolak sebelum buka / saat cutoff / batch non-published | `api-registrations.test.ts` | unit | PASS |
| 9 | Route registrasi menolak kuantitas melebihi max tier | `api-registrations.test.ts` | unit | PASS |
| 10 | Fail-closed 503 saat Redis tidak tersedia (bukan fail-open) | `api-registrations.test.ts` | unit | PASS |
| 11 | Route registrasi hormat rate limit (429) per UMKM | `api-registrations.test.ts` | unit | PASS |
| 12 | Route cutoff dapatkan lock → jalankan RPC → lepas lock | `api-batch-cutoff.test.ts` | unit | PASS |
| 13 | Route cutoff 409 menjadi reader saat lock dikuasai request lain | `api-batch-cutoff.test.ts` | unit | PASS |
| 14 | Route cutoff 409 (bukan 500) bila batch sudah closed | `api-batch-cutoff.test.ts` | unit | PASS |
| 15 | RPC `cut_off_batch` security definer, idempoten, audited | `cutoff-gatekeeper.test.ts` | migration | PASS |
| 16 | Enum `audit_action` + `REQUIRED_FUNCTIONS` diperbarui tanpa merusak contract | `schema.test.ts` | migration | PASS |

## Keputusan Desain (sharpened selama grilling)

- **Redis fail-closed untuk volume/harga** (503), berbeda dengan rate-limit yang fail-open — volume & harga adalah kebenaran finansial.
- **Cutoff menghitung volume dari baris `registrations`** (sumber durable, direkonsiliasi ke `registration_counters`), bukan nilai live Redis — registrasi yang sudah ter-insert tidak hilang dan INCR yang belum menjadi baris tidak menggelembungkan tier.
- **Distributed lock ber-TTL + owner-token + compare-and-delete** — crash holder tidak mematikan batch selamanya; hanya pemilik dapat melepas lock.
- **Lazy Evaluation dijaga** — tidak ada cron; cutoff dipicu on-demand melalui endpoint di belakang SETNX.

## Gaps / Catatan

- `tests/live/database.integration.test.ts` memerlukan Supabase nyata dengan migrasi ter-deploy. Karena `cut_off_batch` ditambahkan ke `REQUIRED_FUNCTIONS`, tes live hanya lulus setelah migrasi `20260831000000_order_cutoff_gatekeeper.sql` dijalankan ke database target.
- `tests/live/redis.integration.test.ts` memerlukan kredensial Upstash nyata; gagal di lingkungan tanpa koneksi.
- Belum ada `fetch_status`/webhook Midtrans reconciliation dalam cakupan fitur ini (PRD 3.1 penanganan delay webhook adalah modul terpisah).

## Security Scan & Verification (security-scan / security-review)

Dijalankan pada 2026-08-31 setelah implementasi tiga fitur. Alat: `ecc-agentshield` (skor konfigurasi agent = A/100, 0 temuan; agen hanya berjalan di config Claude Code global), `security-audit` (code scan: pass, tanpa temuan), plus review teknis pada route/lib/migrasi baru.

### Temuan yang diperbaiki

| # | Temuan | Tingkat | Perbaikan | Test baru |
|---|--------|---------|-----------|-----------|
| 1 | Upsert `registration_counters` dari route UMKM adalah **no-op diam-diam** — RLS hanya mengizinkan `select` untuk `authenticated` (migrasi 0003), tanpa INSERT/UPDATE. Jika aslinya ditambahkan policy longgar, ia menjadi permukaan tamper terhadap mirror counter. | Medium | Hapus blok upsert dari `app/api/registrations/route.ts`; mirror ditulis durably oleh security-definer `cut_off_batch()` saat cutoff (Redis tetap sumber runtime, PRD 3.2 "mirror" untuk recovery). | `api-registrations.test.ts` "records the registration ... upsert not called" |
| 2 | **Counter drift** — INCR dijalankan sebelum insert; jika insert gagal (duplikat → 409, atau 500) count Redis menggelembung dan tidak pernah dikembalikan. | Low | Tambah `decrementVolumeCounter()` (DECR), dipanggil pada kedua jalur error insert (best-effort, tidak mengubah status HTTP). | `registration-counter.test.ts` "decrementVolumeCounter"; `api-registrations.test.ts` dua kasus DECR |
| 3 | **Key Redis volume tanpa TTL** — `batch:<id>:count` menumpuk selamanya per batch. | Low | Tambah `resetVolumeCounter()` (DEL) yang dipanggil setelah cutoff sukses di `app/api/batches/[id]/cutoff/route.ts` (sumber durable `registrations` + `registration_counters` sudah menutupinya). | `registration-counter.test.ts` "resetVolumeCounter"; `api-batch-cutoff.test.ts` kasus DEL pada sukses & bukan pada 409 |
| 4 | **Grant default PUBLIC/anon EXECUTE** pada `cut_off_batch` (guard `auth.uid() is null` memang backstop, namun least privilege sebaiknya eksplisit). | Hardening | Tambah `revoke execute ... from public, anon` + `grant execute ... to authenticated` di akhir migrasi. | `cutoff-gatekeeper.test.ts` "removes default PUBLIC/anon EXECUTE" |

### Yang ditinjau & dinyatakan aman

- **Authorization cutoff**: kepemilikan batch di-enforce **di dalam RPC** (`v_supplier_id <> auth.uid()`, plus `public.is_admin()`), bukan hanya RLS — supplier non-pemilik tidak bisa menutup batch milik orang lain.
- **SQL injection**: seluruh input adalah `uuid` ber-tipe kuat, tanpa `format()`/string concat — RPC aman.
- **Race condition**: lock `SETNX` memakai owner-token unik + TTL ~30s + release via Lua compare-and-delete (hanya pemilik yang bisa lepas; holder crash tidak mengunci batch selamanya).
- **Fail-closed**: registrasi/cutoff `503` saat Redis down (kebenaran volume/harga), berbeda dengan rate-limit yang fail-open — kesengajaan, didokumentasikan.
- **DoS/abuse**: kedua endpoint dilindungi rate limit per-user; `quantity` divalidasi integer > 0 dan dibatasi terhadap `max_volume` tertinggi tier.

### Keputusan tidak mengubah (alasan)

- **Volume cap agregat tidak di-enforce saat window** (temuan reviewer). PRD 3.1/3.2 memperlakukan tier sebagai *threshold pencapaian diskon* (PRD step 9-10, rule baris 214): "pesanan UMKM tidak batal" saat ambang tidak tercapai — bukan kuota yang dikonsumsi. Penutupan "secara mutlak" ditetapkan **saat cutoff** (status `closed` + lock harga), bukan penolakan per-request di tengah window. Mengubahnya menjadi penolakan agregat akan melanggar business rule PRD.
- **`x-forwarded-for` / `user-agent` client disimpan ke audit log** — dapat dipalsukan client, konsisten dengan pola seluruh route admin yang sudah ada; tidak diubah agar tidak menambah perbedaan perilaku (IP tepercaya berasal dari proxy platform).
