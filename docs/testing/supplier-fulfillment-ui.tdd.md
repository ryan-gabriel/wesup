# TDD Evidence Report — Supplier Fulfillment UI (PRD 2.1.5 Dasbor Manajemen UMKM & Serah Terima)

## Source plan
Rencana disusun dari analisis fitur **2.1.5 Dasbor Manajemen UMKM & Serah Terima (Fulfillment)** pada `prd/PRD.md` dan migrasi backend yang sudah ada (`supabase/migrations/20260831030000_fulfillment_pickup.sql` dengan RPC `list_batch_orders`, `generate_pickup_code`, `confirm_pickup`, dan `force_majeure_cancel`).

Pekerjaan ini membangun **basis-UI statis** untuk peran Supplier, sesuai area lisensi:
- Poin 1 — **data layer** (types, mock-data, mock-repository, reducers).
- Poin 2 — **dasbor pesanan** (`/supplier/batch/[id]/orders`).
- Poin 3 — **serah terima** (`/supplier/batch/[id]/pickup`): pindai QR statis + PIN 4-digit + **Pembatalan Darurat (Force Majeure)**.
- Poin 4 — **TDD & dokumentasi** (file ini).

Keputusan yang disepakati pengguna: rute bersarang di bawah detail batch; pemindai QR **disimulasikan** (tanpa ketergantungan kamera); Force Majeure **batch-level** (beda dari "Hapus Katalog" biasa) yang membatalkan seluruh batch → Full Refund dan tanpa sanksi No-Show bagi UMKM.

## User journeys
- Sebagai Supplier, saya ingin melihat daftar pesanan per batch (status: Terdaftar, Menunggu Bayar, Lunas, Sudah Diambil, Tidak Hadir) sehingga saya tahu berapa pesanan yang harus disiapkan.
- Sebagai Supplier, saya ingin memvalidasi pengambilan barang via pindai QR atau PIN 4-digit, dan hanya pesanan **Lunas** yang boleh diverifikasi.
- Setelah berhasil, saya ingin pesanan ditandai **Sudah Diambil** dan escrow **1×24 jam** berjalan.
- Sebagai Supplier, saya ingin membatalkan seluruh batch secara darurat (Force Majeure) dengan konfirmasi, yang memicu Full Refund dan **tidak** menghukum UMKM sebagai No-Show.

## Task report
Eksekusi mengikuti alur TDD (RED → GREEN → refactor). Karena konfigurasi Vitest proyek berjalan di `environment: "node"` dan hanya menarget `tests/**/*.test.ts` (tanpa jsdom / React Testing Library), strategi yang dipilih (konsisten dengan `lock-tier.tdd.md`, strategi B1) adalah **unit test pada logika murni** (data layer + reducers), sementara perilaku UI diverifikasi lewat `npm run build` dan `npm run lint`.

### Task: data layer statis (Poin 1)
- **Ringkasan:** Types, mock data, mock repository, dan dua reducer murni untuk fulfillment.
- **File produksi:** `lib/supplier-fulfillment/types.ts`, `mock-data.ts`, `mock-repository.ts`, `state.ts`, `pickup-state.ts`
- **File test:** `tests/unit/supplier-fulfillment.test.ts`
- **Validation command:** `npx vitest run tests/unit/supplier-fulfillment.test.ts`

**RED — output awal (sebelum test/data layer):**
```
FAIL  tests/unit/supplier-fulfillment.test.ts
Error: Cannot find package '@/lib/supplier-fulfillment/mock-repository' imported from .../supplier-fulfillment.test.ts
```

**GREEN — setelah data layer dibuat:**
```
Test Files  1 passed (1)
     Tests  22 passed (22)
```

### Task: dasbor pesanan (Poin 2)
- `components/supplier/fulfillment/OrderListClient.tsx` — tabel desktop + kartu mobile, tab filter status, kartu ringkasan, skeleton/error/empty state, CTA ke `/pickup`.
- `app/supplier/batch/[id]/orders/page.tsx` — route server wrap (`force-dynamic`).
- `components/supplier-batch/SupplierBatchDetailClient.tsx` — tambah tombol "Manajemen Pesanan" & "Serah Terima (QR / PIN)".

### Task: serah terima + Force Majeure (Poin 3)
- `components/supplier/fulfillment/PickupScannerClient.tsx` — pilih pesanan, simulasi viewfinder QR + input kode, input PIN 4-digit, validasi, banner sukses (escrow 24 jam), section Force Majeure.
- `components/supplier/fulfillment/ForceMajeureDialog.tsx` — dialog konfirmasi `<dialog>` (mengikuti pola `DeleteCatalogDialog`), dengan tombol yang disabled saat loading, dan pemulihan fokus.
- `lib/supplier-fulfillment/pickup-state.ts` — reducer `pickupViewReducer` untuk state pemindai + force majeure.
- `app/supplier/batch/[id]/pickup/page.tsx` — route server wrap (`force-dynamic`, dibungkus `Suspense` untuk `useSearchParams`).

## Test specification

| # | Yang dijamin | Test file | Test type | Hasil | Evidence |
|---|--------------|-----------|-----------|-------|----------|
| 1 | `listOrders` hanya mengembalikan pesanan milik batch yang diminta | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 2 | `listOrders` mengembalikan daftar kosong untuk batch tanpa pesanan | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 3 | `listOrders` mengembalikan kloning (mutasi pemanggil tidak mencemari store) | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 4 | `confirmPickup` menolak kode kosong (`invalid_code`) | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 5 | `confirmPickup` menolak registrasi tak dikenal (`order_not_found`) | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 6 | `confirmPickup` menolak pesanan yang sudah diambil (`already_picked_up`) | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 7 | `confirmPickup` menolak pesanan belum lunas (`not_eligible`) | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 8 | `confirmPickup` menolak kode QR salah (`invalid_code`) | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 9 | `confirmPickup` sukses via QR valid → status `picked_up`, method `qr`, kode di-null | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 10 | `confirmPickup` sukses via PIN 4-digit valid → method `pin` | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 11 | pickup tersimpan sehingga `listOrders` berikutnya mencerminkan `picked_up` | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 12 | `forceMajeureCancel` membatalkan pesanan & melaporkan jumlah refund | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 13 | `forceMajeureCancel` gagal untuk batch demo error (`force_majeure_failed`) | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 14 | Reducer daftar: lifecycle load (loading/success/error + pesan) | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 15 | Reducer daftar: perubahan filter status | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 16 | Reducer daftar: `orderPickedUp` mengganti pesanan di tempat | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 17 | Reducer pemindai: lifecycle load + seleksi pesanan | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 18 | Reducer pemindai: ganti metode (QR/PIN) mengosongkan kode | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 19 | Reducer pemindai: confirm sukses memperbarui pesanan di daftar | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 20 | Reducer pemindai: confirm gagal lalu reset | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 21 | Reducer pemindai: force majeure open/sukses menandai pesanan dibatalkan | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |
| 22 | Reducer pemindai: dialog tetap terbuka saat force majeure loading | `tests/unit/supplier-fulfillment.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-fulfillment.test.ts` |

## Verifikasi seluruh suite
```
Test Files  23 passed (23)
     Tests  285 passed (285)
```

## Coverage dan gap yang diketahui
- Data layer + kedua reducer tercakup unit test (22 kasus). Coverage helper berjalan di lingkungan `node` (tanpa jsdom) sehingga perilaku **rendering UI** (tabel, kartu, tab, dialog, toast) tidak di-cover otomatis — selaras strategi B1 yang dipakai `lock-tier.tdd.md`.
- Perilaku UI diverifikasi via `npx eslint` (bersih) dan `npx tsc --noEmit` (bersih untuk file fulfillment), serta mengikuti pola yang sudah ada (`DeleteCatalogDialog`, `GlobalToast`, `SkeletonLoading`, `EmptyState`).
- Simulasi pemindai QR sengaja **tidak** memakai kamera (keputusan pengguna); kamera diaktifkan pada iterasi berikutnya.
- `batch-active-002` digunakan sebagai batch demo untuk menampilkan state error Force Majeure.

## Merge evidence
RED/GREEN ringkasan di atas sudah dicatat. Tidak ada squash pada cabang tugas ini (mengikuti pola dokumen TDD sebelumnya).
