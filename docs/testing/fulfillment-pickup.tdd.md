# Fulfillment & Pickup — TDD Evidence

Tanggal verifikasi: 2026-08-31
Migrasi: `20260831030000_fulfillment_pickup.sql` (Slice 2 subset)

## Scope

Menutup gap PRD 2.2.6: alur pickup sisi backend — kode pickup (QR+PIN), konfirmasi
pickup, pembuatan escrow hold, dan dashboard pesanan supplier. (Payment integration
berada di luar scope; gate-nya adalah `registrations.status = 'paid'`.)

1. **`generate_pickup_code(reg_id, ...)`** (RPC + `POST /api/pickups/[regId]/code`)
   - hanya menerbitkan kode setelah registrasi `paid`
   - QR token unik (hex 18-byte) + PIN 4 digit
   - idempoten: mengembalikan kode yang sudah ada
   - diotorisasi untuk UMKM pemilik / supplier pemilik / admin
2. **`create_escrow(reg_id, when)`** — helper internal yang membuat `escrow_holds`
   dengan `auto_release_at = pickup + 24h`, idempoten via `on conflict`.
3. **`confirm_pickup(reg_id, method('qr'|'pin'), code, lat, lng, notes)`**
   (RPC + `POST /api/pickups/[regId]/confirm`)
   - hanya registrasi `paid` eligible; `picked_up`/terminal ditolak
   - validasi kode terhadap `pickup_codes` (belum terpakai)
   - menulis `pickup_events`, menandai `picked_up`, memanggil `create_escrow`
4. **`list_batch_orders(batch_id)`** (RPC + `GET /api/suppliers/batches/[id]/orders`)
   - dashboard supplier; hanya supplier pemilik / admin

Keputusan penting: gate "paid" memakai `registrations.status = 'paid'` (sumber
kebenaran bisnis yang dipakai escrow & cutoff), bukan tabel `payments` langsung —
konsisten dengan arsitektur dan menghindari asumsi objek pembayaran (out of scope).

## RED/GREEN Evidence

### Task — migrasi `tests/migrations/fulfillment-pickup.test.ts`

RED: `generate_pickup_code only issues a code once payment is settled` gagal karena
implementasi awal memakai cek negatif `r.status <> 'paid'` (tidak cocok dengan
`/status = 'paid'/`) dan tidak ada jelasan gate. Dikoreksi menjadi cek positif
`not exists (... r.status = 'paid')` dan asersi test dirapikan ke sumber kebenaran
`registrations`.

GREEN (8/8):

```text
npx vitest run tests/migrations/fulfillment-pickup.test.ts
Test Files  1 passed (1)   Tests  8 passed (8)
```

Schema contract diperbarui (`REQUIRED_FUNCTIONS` + `audit_action` + `types/database.ts`),
`tests/migrations/schema.test.ts` tetap hijau (191 total).

## Regression

`tests/migrations/schema.test.ts` (179+12=191), `tests/migrations/backend-lifecycle.test.ts`
(10) hijau. `tsc --noEmit` bersih untuk file baru.

## Files

Baru: `supabase/migrations/20260831030000_fulfillment_pickup.sql`,
`app/api/pickups/[registrationId]/code/route.ts`,
`app/api/pickups/[registrationId]/confirm/route.ts`,
`app/api/suppliers/batches/[id]/orders/route.ts`,
`tests/migrations/fulfillment-pickup.test.ts`.
Diedit: `tests/helpers/schema-contract.ts`, `types/database.ts`.
