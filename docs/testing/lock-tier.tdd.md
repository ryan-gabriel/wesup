# TDD Evidence Report — Supplier Lock Tier (PRD 2.1.3)

## Source plan
Rencana disusun dari analisis fitur **2.1.3 Pengaturan Timeline & Tier Diskon** pada `prd/PRD.md`. PRD mensyaratkan: *"Skema tingkatan harga diskon tidak bisa diubah atau dimodifikasi di tengah siklus (lock tier) begitu pendaftar pertama bergabung."*

Audit menemukan satu celah: `EditCatalogForm` hanya mengunci **lokasi**, sedangkan **skema harga tier** masih dapat diedit meski sudah ada peserta terdaftar. Perubahan ini menutup celah tersebut agar seluruh 2.1.3 selaras dengan PRD.

## User journeys
- Sebagai Supplier, saya ingin skema harga tier terkunci begitu ada peserta pertama bergabung, sehingga harga diskon tidak bisa diubah di tengah siklus (kepastian harga bagi UMKM).
- Sebagai Supplier, saya tetap dapat mengedit detail lain (produk, lokasi/nama, deskripsi, timeline) tanpa mengubah skema harga yang sudah terkunci.

## Task report
Eksekusi mengikuti alur TDD (RED → GREEN → refactor) pada **helper logika murni** karena konfigurasi Vitest proyek berjalan di `environment: "node"` dan hanya menarget `tests/**/*.test.ts` (tanpa jsdom / React Testing Library). Strategi yang dipilih (B1) — unit test pada helper murni tanpa menambah dependensi test-komponen baru, konsisten dengan peran basis-UI statis.

### Task: helper `isTierSchemeLocked`
- **Ringkasan:** Menyatakan apakah skema harga tier terkunci berdasarkan jumlah peserta.
- **File produksi:** `lib/supplier-catalog/lock.ts`
- **File test:** `tests/unit/supplier-catalog-lock.test.ts`
- **Validation command:** `npm test -- tests/unit/supplier-catalog-lock.test.ts` dan `npx vitest run tests/unit/supplier-catalog-lock.test.ts --coverage --coverage.include="lib/supplier-catalog/lock.ts"`

**RED — output awal (sebelum helper dibuat):**
```
FAIL  tests/unit/supplier-catalog-lock.test.ts
Error: Cannot find package '@/lib/supplier-catalog/lock' imported from .../supplier-catalog-lock.test.ts
```

**GREEN — setelah helper dibuat:**
```
Test Files  1 passed (1)
     Tests  3 passed (3)
```

**Coverage helper (baris/branch/function/statement): 100%**

### Task: integrasi lock-tier ke komponen
- `components/supplier/catalog/EditCatalogForm.tsx` — memanggil `isTierSchemeLocked(batch.participantCount)` untuk menentukan `tiersLocked`; menampilkan banner "Skema harga terkunci" bila terkunci; meneruskan `tiersLocked` ke form.
- `components/supplier/catalog/CreateCatalogForm.tsx` — menambah prop opsional `tiersLocked` (default `false`) dan meneruskannya ke `TierPricingStep`.
- `components/supplier/catalog/steps/TierPricingStep.tsx` — menambah prop `locked`; saat terkunci, men-disable seluruh input tier, tombol tambah/hapus tier, dan menampilkan banner `role="alert"` (mengikuti pola lock-lokasi pada `PickupLocationStep`).
- `components/supplier/dashboard/SupplierDashboard.tsx` — menambah bullet pada "Informasi Penting" terkait lock-tier.

## Test specification

| # | Yang dijamin | Test file | Test type | Hasil | Evidence |
|---|--------------|-----------|-----------|-------|----------|
| 1 | Skema tier terkunci saat peserta pertama bergabung (count >= 1) | `tests/unit/supplier-catalog-lock.test.ts` | unit | PASS | `npm test -- tests/unit/supplier-catalog-lock.test.ts` |
| 2 | Skema tier terkunci untuk sembarang peserta > 0 | `tests/unit/supplier-catalog-lock.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-catalog-lock.test.ts --coverage` |
| 3 | Skema tier tetap terbuka selama belum ada peserta (0, negatif, NaN) | `tests/unit/supplier-catalog-lock.test.ts` | unit | PASS | `npm test -- tests/unit/supplier-catalog-lock.test.ts` |

## Coverage dan gap yang diketahui
- Helper `isTierSchemeLocked` tercakup **100%** (statements, branches, functions, lines).
- Karena proyek berjalan di Vitest `environment: "node"` tanpa jsdom/RTL, perilaku **UI** (disable input, banner) tidak di-cover oleh tes otomatis — sesuai strategi B1. Verifikasi UI dilakukan lewat `npm run build` dan `npm run lint` (perilaku mengikuti pola lock-lokasi yang sudah ada dan konsisten).

## Merge evidence
RED/GREEN ringkasan di atas sudah dicatat; tidak ada squash pada cabang tugas ini.
