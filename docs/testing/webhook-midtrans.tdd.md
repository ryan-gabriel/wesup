# TDD Evidence — Webhook Midtrans + QA Kill-Switch (+ Rekonsiliasi Cutoff ke RPC)

## 1. Source & keputusan desain

Task PM 3 item. Item 1 (algoritma cutoff) sudah dikerjakan sesi sebelumnya,
tapi merge `main` membawa desain tandingan (RPC `cut_off_batch()` + migrasi +
test). Atas persetujuan PM: **adopsi RPC main**, implementasi app-layer saya
dihapus (`lib/batches/cutoff*.ts`, hooks, test + doc-nya). Alasan: RPC
transaksional (anti-TOCTOU via trigger `prevent_registration_outside_window`),
ter-audit, dan sudah jadi arah tim.

## 2. User journeys

- **J1** — Callback settlement valid → payment `paid` + registration `paid`,
  log append-only tercatat.
- **J2** — Signature palsu (401), amount mismatch (400), order tak dikenal
  (404), duplikat (200 tanpa mutasi), lock dipegang worker lain (409).
- **J3** — QA mematikan/menunda sinkronisasi webhook di staging/dev;
  webhook yang masuk selama off → 202 deferred tanpa mutasi (bisa
  direkonsiliasi setelah di-enable). Production: 403.

## 3. Task report

| Task | Summary | Validation | Output |
|---|---|---|---|
| Rekonsiliasi cutoff | Route cutoff rewrite: rate-limit + requireRole supplier/admin + `acquireCutoffLock` + `rpc cut_off_batch` + `resetVolumeCounter`; hapus 538 baris duplikat | `npm test -- api-batch-cutoff api-registrations registration-counter` | 34/34 PASS (sebelumnya 3 gagal) |
| Test RED webhook | 3 file test baru, modul belum ada | `npm test -- midtrans-signature api-webhook-midtrans api-webhook-qa` | RED — 3 suites gagal import |
| Implementasi GREEN | `lib/payments/midtrans.ts` (SHA512 stdlib + outcome mapper) + `POST /api/webhook/midtrans` + `GET/POST /api/webhook/midtrans/qa` | sama | GREEN — 21/21 PASS |
| Fix env | `server-only` belum terinstal (dibutuhkan `lib/supabase/admin.ts` main); testing-library hilang dari node_modules pasca-reinstall env | `npm install server-only`, `npm install -D @testing-library/*` | suite jalan lagi |
| Regresi | Full non-live | `npm test -- tests/unit tests/migrations` | 62 files, 706/706 PASS |
| Lint | `npm run lint` | 0 errors (9 warnings pre-existing di file lain) | — |
| Coverage | `midtrans.ts` 96% stmts / 100% branch; gap: `catch` defensif `Buffer.from` (unreachable — length-check menangani) | — | — |

Checkpoint commits di `dev_arul`: `86368a7` (RED) → `4df6e2a` (GREEN) →
`69db229` (lockfile) → + fix warning & doc ini.

## 4. Test specification (21 baru)

| # | Guarantee | Test | Result |
|---|---|---|---|
| 1–4 | Signature asli diterima; tamper amount/key salah/malformed ditolak | `midtrans-signature.test.ts` | PASS |
| 5–8 | settlement/capture+accept→paid; capture+challenge→pending; expire→expired; cancel/deny/failure→failed; pending/unknown→pending | `midtrans-signature.test.ts` | PASS |
| 9 | Settlement → paid + log processed | `api-webhook-midtrans: marks paid` | PASS |
| 10 | Already-paid → 200 tanpa mutasi | `idempotent` | PASS |
| 11 | Signature palsu → 401, tanpa DB touch | `forged` | PASS |
| 12 | Amount mismatch → 400, tanpa mutasi | `amount mismatch` | PASS |
| 13 | Order tak dikenal → 404 | `unknown order` | PASS |
| 14 | Expire → expired + cancelled | `expire` | PASS |
| 15 | Kill-switch on → 202 tanpa mutasi | `defers` | PASS |
| 16 | Lock sibuk → 409 | `lock` | PASS |
| 17–21 | Production 403; disable indefinite; disable TTL + enable; mode/ttl invalid 400; wajib sign-in | `api-webhook-qa.test.ts` (5) | PASS |

## 5. Known gaps & follow-up tim

- `tests/live/*` + `npm run build` gagal pre-existing (drift DB live,
  `lucide-react` — dilaporkan sesi lalu, bukan dari diff ini).
- Rekonsiliasi manual Fetch Status Midtrans pasca-payment-window (PRD Fase 5
  langkah 13, sanksi Hit-and-Run) belum ada — task role berikutnya.
- Env yang dibutuhkan di staging: `MIDTRANS_SERVER_KEY`,
  `APP_ENV=development|staging` (jangan `production`), opsional
  `MIDTRANS_WEBHOOK_SECRET`.
