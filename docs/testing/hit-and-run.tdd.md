# TDD Evidence — Auto-Suspend Hit & Run + Arbiter Irreversibility

## 1. Inventory (apa yang sudah ada vs gap)

Ada (milik tim, diverifikasi — tidak ditulis ulang): Arbiter resolve route +
RPC `resolve_dispute`, komplain UMKM (`POST /api/escrow/[id]/dispute`),
suspend/ban manual, **recovery unban** (`POST /api/admin/users/[id]/unban` →
`unban_user`, beserta test-nya). Recovery banned→aktif untuk task ini
dinyatakan selesai lewat verifikasi, bukan kode baru.

Gap yang dikerjakan sesi ini:
1. **Auto-Suspend Hit & Run (PRD 3.4)** — tidak ada RPC/route/test sama sekali.
2. **Arbiter irreversibility (PRD 2.3.4)** — `resolve_dispute()` menimpa
   keputusan berulang (tanpa guard status); route selalu 500 generik.

## 2. Journeys

- **J1** — Pasca payment-window tutup, satu panggilan mengeskalasi strike
  semua penunggak: 1→peringatan, 2→suspend 7 hari retrospektif dari
  `payment_closes_at`, 3+→permanen; order mati jadi `cancelled`; rerun no-op.
- **J2** — Keputusan Arbiter satu arah: resolve kedua ditolak 409.

## 3. Task report

| Task | Validation | Output |
|---|---|---|
| RED: `hit-and-run.test.ts` (9 pin SQL) + `api-batch-reconcile.test.ts` (6) + 1 test 409 di `api-admin.test.ts` | `npm test` 3 file | 10 gagal sesuai target |
| GREEN: migrasi `20260909060000_hit_and_run.sql` (`apply_hit_and_run` + `resolve_dispute` diperketat + enum + grants), route `POST /api/batches/[id]/reconcile`, mapping 409 resolve, entri `Database` + `schema-contract` | sama | 44/44 |
| Pin longgar retrospektif + urutan enum ikut file migrasi | full suite | 725/725 (65 file), lint 0 errors |

Commits: `bacac89` (RED) → commit GREEN ini.

## 4. Test specification (16 baru)

| # | Guarantee | Test | Result |
|---|---|---|---|
| 1–7 | RPC definer, auth admin/supplier, tolak pre-window, hanya unpaid non-paid, eskalasi 1/2/7-hari/perm, notifikasi + cancel, audit + grants | `hit-and-run.test.ts` | PASS |
| 8 | Resolve kedua ditolak di SQL | `hit-and-run.test.ts` (irreversibility) | PASS |
| 9–14 | 400 UUID; lock→RPC→release→summary; lock sibuk 409; window buka 409; unknown 404 / asing 500; umkm 403 | `api-batch-reconcile.test.ts` | PASS |
| 15 | Route resolve memetakan 'already resolved' → 409 | `api-admin.test.ts` | PASS |
| 16 | Enum `audit_action` memuat `apply_hit_and_run` terakhir | `schema.test.ts` (via contract) | PASS |

## 5. Known gaps & follow-up

- Fetch Status Midtrans manual sebelum strike (PRD Fase 5 langkah 13) belum
  ada — RPC mengandalkan status webhook; client API Midtrans = task berikut.
- `suspended_permanent` (strike-3) tak bisa pulih via `unban_user` (hanya dari
  `banned`); banding manual butuh alur/tombol khusus — keputusan PM.
- `umkm_profiles` tak pernah dibuat saat signup (tak ada writer) — strike
  pertama meng-upsert baris dengan kolom bisnis kosong; onboarding UMKM
  adalah gap milik modul IAM.
- `tests/live/*` + build tetap merah pre-existing (drift DB live, deps).
- Staging butuh env: jalankan migrasi ini sebelum uji reconcile.
