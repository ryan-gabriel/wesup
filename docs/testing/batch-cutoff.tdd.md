# TDD Evidence — API Penguncian Volume saat Cutoff (Lazy Evaluation)

## 1. Source plan

Tidak ada `*.plan.md` — journeys diturunkan dari PRD Fase 4 langkah 9–10 dan
PRD 3.1/3.2 selama sesi ini, plus 2 keputusan PM: volume = **count pendaftar**,
bentuk API = **hybrid** (endpoint eksplisit + lazy otomatis).

## 2. User journeys

- **J1** — Sebagai sistem, saat `registration_closes_at` lewat saya mengunci
  harga tier dari count pendaftar agar invoice QRIS pasti; di bawah Tier 2
  → terkunci Tier 1 (harga dasar).
- **J2** — Sebagai platform tanpa cron, cutoff dieksekusi request pertama
  pasca-tutup di bawah distributed lock; request konkuren lain hanya membaca.
- **J3** — Sebagai UMKM yang daftar setelah cutoff saya ditolak Gatekeeper;
  sebagai UMKM yang daftar sebelum cutoff, status saya menjadi
  `pending_payment` dengan `final_amount` terkunci untuk dibayar.

## 3. Task report

| Task | Summary | Validation | Output | Guarantee |
|---|---|---|---|---|
| Tulis test RED | 2 file test baru mengimpor modul yang belum ada | `npm test -- tests/unit/batch-cutoff.test.ts tests/unit/api-batch-cutoff.test.ts` | RED — 2 failed suites, `Cannot find package '@/lib/batches/cutoff'` | Test terbukti menargetkan implementasi yang hilang, bukan setup rusak |
| Implementasi GREEN | `lib/batches/cutoff.ts` (pure) + `cutoff-runner.ts` (adapter) + `POST /api/batches/[id]/cutoff` + hook lazy di register/pay/batch-detail | sama seperti di atas | GREEN — 19/19 PASS | Resolusi tier, fallback Tier 1, idempotensi, lock contention |
| Regresi | Full suite non-live | `npm test -- tests/unit tests/migrations` | 28 files, 452/452 PASS | Tidak ada regresi |
| Lint | `npm run lint` | 0 errors (1 warning pre-existing `app/page.tsx`) | — | — |
| Typecheck file baru | `npx tsc --noEmit` difilter ke file yang disentuh | nihil error | — | — |
| Pre-existing failures | `tests/live/*` 8 gagal → diverifikasi via `git stash -u` di tree bersih: 7 gagal di file yang sama | drift DB live (enum berlebih, RLS, `pickup_name`), bukan dari diff ini | — | — |
| Build | `npm run build` | GAGAL pre-existing: `lucide-react` tidak terinstal (18 errors, semua di komponen frontend yang tak disentuh) | — | follow-up: `npm install` |

Checkpoint commits di branch `dev_arul`: `869396f` (RED) → `d431854` (GREEN).

## 4. Test specification

| # | Guarantee | Test file / command | Type | Result |
|---|---|---|---|---|
| 1 | Volume di bawah minimum → Tier 1 | `batch-cutoff.test.ts: locks Tier 1…` | unit | PASS |
| 2 | Tier tertinggi yang memenuhi menang (50/99→T2, 100+→T3) | `batch-cutoff.test.ts: picks the highest…` | unit | PASS |
| 3 | Volume di celah tier → tier bawah (tanpa diskon cuma-cuma) | `…inside a volume gap` | unit | PASS |
| 4 | Urutan input tier tidak berpengaruh; tier kosong → null | 2 tests | unit | PASS |
| 5 | Sebelum closes_at: skip tanpa sentuh lock | `…without touching the lock` | unit | PASS |
| 6 | Batch sudah closed / tidak ada / tanpa tier: skip idempoten | 3 tests | unit | PASS |
| 7 | Saat jatuh tempo: commit tier + registrasi, release lock | `…commits pending registrations` | unit | PASS |
| 8 | Volume 7 → Tier 1 terkunci | `…falls back to Tier 1` | unit | PASS |
| 9 | Redis kosong → fallback DB count | `…falls back to the DB count` | unit | PASS |
| 10 | Lock dipegang pihak lain → reader, tanpa migrasi ganda | `…as reader…` | unit | PASS |
| 11 | Commit gagal → lock tetap dirilis | `…even when commit throws` | unit | PASS |
| 12 | Endpoint: UUID buruk → 400 tanpa auth; anon → 401 | `api-batch-cutoff.test.ts` (2 tests) | integration | PASS |
| 13 | Endpoint sukses → `locked_tier/total_volume/affected` + server timestamp | `…server timestamp` | integration | PASS |
| 14 | Endpoint idempoten → `locked:false`; lock sibuk → 202 | 2 tests | integration | PASS |

## 5. Coverage and known gaps

- `lib/batches/cutoff.ts`: 96.87% stmts / 95% branch / 100% funcs. Satu-satunya
  yang tak ter-cover: guard defensif `if (!tier)` (unreachable — `resolveTier`
  hanya null saat tiers kosong, yang sudah dijaga; dipertahankan untuk
  type-narrowing).
- `lib/batches/cutoff-runner.ts`: 0% unit (di-mock di test route) — murni
  wiring Supabase/Redis; kandidat live integration test saat kredensial siap.
- Hook lazy di `register`/`pay`/`batch-detail`: 1–10 baris per route, tanpa
  test route khusus (konsisten dengan route lain yang belum punya test route).

## 6. Merge evidence

RED (`869396f`): 2 suites gagal import — implementasi belum ada.
GREEN (`d431854`): 19/19 PASS + 452/452 unit+migrations PASS, lint 0 errors.
Live-test dan build failures terbukti pre-existing (tree bersih gagal sama).
Aman di-squash dengan menyalin ringkasan ini ke body PR.
