# TDD Evidence Report — Penilaian & Ulasan (PRD 2.2.6 Reputasi)

## Source plan
Rencana disusun dari analisis fitur **2.2.6 Penilaian & Ulasan (Reputasi)** pada `prd/PRD.md` dan dependensinya (2.2.4 Serah Terima, 2.2.5 Sengketa & Refund). Tabel `ratings` sudah dibuat di migrasi (`unique(registration_id)`, skor 1–5), tetapi **belum ada UI apa pun**.

Ruang lingkup A+B+C yang disepakati pengguna — semua **basis-UI statis** (data mock, role selanjutnya mengganti dengan data nyata):

- **A. Form penilaian UMKM** (`/pesanan/[orderId]/nilai`) dengan input bintang 1–5 + komentar opsional, serta gate akses `unlocked | already_rated | blocked_no_show | locked_pre_pickup`.
- **B. Halaman reputasi supplier** (`/supplier/(dashboard)/akun/ulasan`) + kartu ringkasan di dasbor.
- **C. Badge rating supplier** di marketplace detail.

Aturan bisnis yang diterapkan (dari PRD):
1. Kolom rating hanya dirender setelah **serah terima fisik rampung** (`picked_up`) — `locked_pre_pickup` di luar itu (termasuk sisi supplier).
2. UMKM berstatus **No-Show** diblokir memberi rating (`blocked_no_show`).
3. **Satu rating per transaksi** — jika sudah ada record maka menampilkan ringkasan, bukan form (`already_rated`).
4. Skor diverifikasi 1–5; agregat mempertahankan rata-rata presisi (tidak dibulatkan sebelum tampil).

## User journeys
- Sebagai UMKM yang sudah mengambil pesanan, saya ingin memberi rating bintang 1–5 dan ulasan singkat sehingga penilaian saya terbaca supplier lain.
- Sebagai UMKM yang pernah menilai, saya tidak boleh menilai ulang transaksi yang sama — cukup melihat ringkasan penilaian saya.
- Sebagai UMKM yang tidak hadir (No-Show), form rating tidak boleh dirender.
- Sebagai supplier, saya ingin melihat rata-rata rating, distribusi per bintang, dan ulasan terbaru pembeli.
- Sebagai calon pembeli di marketplace, saya ingin melihat reputasi supplier sebelum mendaftar batch.

## Task report
Strategi test handler memakai **unit test pada logika murni** (data layer) **dan component test jsdom (RTL + user-event)** untuk perilaku form, gate, distribusi, dan badge — konfigurasi Vitest proyek mendukung jsdom via pragma `// @vitest-environment jsdom` per file.

### Task: data layer rating (A)
- **File produksi:** `lib/ratings/types.ts`, `lib/ratings/aggregate.ts`, `lib/ratings/mock-data.ts`
- **File test:** `tests/unit/ratings.test.ts`
- **Validation command:** `npx vitest run tests/unit/ratings.test.ts`

**RED — sebelum data layer:**
```
FAIL  tests/unit/ratings.test.ts
Error: Cannot find package '@/lib/ratings/aggregate' imported from .../ratings.test.ts
```

**GREEN — setelah data layer dibuat:**
```
Test Files  1 passed (1)
     Tests  18 passed (18)
```

### Task: form rating UMKM (A)
- `components/ratings/RatingFormClient.tsx` — input bintang `<button aria-pressed>` dalam `<fieldset>`/`<legend>` (keyboard-operable, live region `role="status"`), komentar opsional, validasi skor wajib (`role="alert"`), panel sukses.
- `app/pesanan/[orderId]/nilai/page.tsx` — route server (`force-dynamic`), `notFound` untuk id tak dikenal.
- `components/orders/OrderCenterClient.tsx` — CTA **Nilai & Ulas** hanya untuk buyer `picked_up` tanpa rating (gate sama dengan form).
- **File test:** `tests/components/RatingFormClient.test.tsx`

**RED — komponen belum ada:**
```
FAIL  tests/components/RatingFormClient.test.tsx
Error: Failed to resolve import "@/components/ratings/RatingFormClient" ...
```

**GREEN — setelah komponen dibuat** (1 assertion diperbaiki: teks "diblokir" muncul di judul & deskripsi → pakai `getByRole("heading")`):
```
Test Files  2 passed (2)
     Tests  24 passed (24)   (18 unit + 6 komponen)
```

### Task: reputasi supplier (B)
- `lib/supplier-ratings/types.ts`, `mock-data.ts` — fixture reputasi + helper `ratingBarsFor`, `recentRatingNotes`.
- `components/supplier/reputation/SupplierReviewsClient.tsx` — rata-rata, distribusi per bintang, ulasan terbaru (semuanya semantik: heading, `div role="group"`, `ol`/`li`).
- `app/supplier/(dashboard)/akun/ulasan/page.tsx` — route server.
- `components/supplier/dashboard/SupplierDashboard.tsx` — kartu "Reputasi & Penilaian" + link.
- **File test:** `tests/unit/supplier-ratings.test.ts`, `tests/components/SupplierReviewsClient.test.tsx`

**RED:**
```
FAIL  tests/unit/supplier-ratings.test.ts
Error: Cannot find package '@/lib/supplier-ratings/mock-data' ...
FAIL  tests/components/SupplierReviewsClient.test.tsx
Error: Failed to resolve import "@/components/supplier/reputation/SupplierReviewsClient" ...
```

**GREEN** (1 assertion test diperbaiki: eyebrow "Penilaian & Ulasan" adalah `<p>`, bukan heading):
```
Test Files  2 passed (2)
     Tests  9 passed (9)   (5 unit + 4 komponen)
```

### Task: badge marketplace (C)
- `components/marketplace/SupplierRatingBadge.tsx` — badge `aria-label` "Rating x,0 dari 5, n ulasan" + empty-state "Belum ada penilaian".
- `lib/marketplace/types.ts` — field opsional `supplierRating`; diisi generator `lib/marketplace/mock-data.ts`.
- `components/marketplace/MarketplaceDetailClient.tsx` — badge di bawah nama supplier.
- **File test:** `tests/components/SupplierRatingBadge.test.tsx`

**RED:**
```
FAIL  tests/components/SupplierRatingBadge.test.tsx
Error: Failed to resolve import "@/components/marketplace/SupplierRatingBadge" ...
```

**GREEN:**
```
Test Files  1 passed (1)
     Tests  2 passed (2)
```

## Test specification

| # | Yang dijamin | Test file | Test type | Hasil | Evidence |
|---|--------------|-----------|-----------|-------|----------|
| 1 | `isRatingUnlocked` hanya true untuk buyer `picked_up` | `tests/unit/ratings.test.ts` | unit | PASS | `npx vitest run tests/unit/ratings.test.ts` |
| 2 | `getRatingScenario`: prioritas `already_rated` saat record ada | `tests/unit/ratings.test.ts` | unit | PASS | ditto |
| 3 | `getRatingScenario`: sisi supplier selalu `locked_pre_pickup` | `tests/unit/ratings.test.ts` | unit | PASS | ditto |
| 4 | `getRatingScenario` bermain untuk semua status buyer | `tests/unit/ratings.test.ts` | unit | PASS | ditto |
| 5 | `getRatingScenarioForOrder`: `ord-umkm-003` → `unlocked` | `tests/unit/ratings.test.ts` | unit | PASS | ditto |
| 6 | `getRatingScenarioForOrder`: `ord-umkm-008` → `already_rated` (record mock ada) | `tests/unit/ratings.test.ts` | unit | PASS | ditto |
| 7 | `getRatingScenarioForOrder`: `ord-umkm-005` → `blocked_no_show` | `tests/unit/ratings.test.ts` | unit | PASS | ditto |
| 8 | `getRatingScenarioForOrder`: `ord-umkm-001` & `ord-sup-002` → `locked_pre_pickup` | `tests/unit/ratings.test.ts` | unit | PASS | ditto |
| 9 | `RATING_RECORD_MOCKS` non-kosong & record tidak mencemari skenario `unlocked` | `tests/unit/ratings.test.ts` | unit | PASS | ditto |
| 10 | `buildRatingBreakdown`: counter 1–5 terisi, total & average presisi | `tests/unit/ratings.test.ts` | unit | PASS | ditto |
| 11 | Form hanya dirender saat `unlocked` (fieldset + tombol 1–5 bintang + kirim) | `tests/components/RatingFormClient.test.tsx` | component | PASS | `npx vitest run tests/components/RatingFormClient.test.tsx` |
| 12 | Submit tanpa bintang → error `role="alert"` "Pilih rating…" | tests/components/RatingFormClient.test.tsx | component | PASS | ditto |
| 13 | Klik bintang → `aria-pressed="true"`, submit → panel "Penilaian berhasil dikirim" | tests/components/RatingFormClient.test.tsx | component | PASS | ditto |
| 14 | No-Show: form tidak dirender, heading "Rating diblokir" tampil | tests/components/RatingFormClient.test.tsx | component | PASS | ditto |
| 15 | `already_rated`: "Penilaian Anda sudah tercatat" + tanpa tombol kirim | tests/components/RatingFormClient.test.tsx | component | PASS | ditto |
| 16 | `locked_pre_pickup`: form tidak dirender, catatan "serah terima" tampil | tests/components/RatingFormClient.test.tsx | component | PASS | ditto |
| 17 | Fixture reputasi supplier: total == Σ skor & rata-rata ∈ [1,5] | `tests/unit/supplier-ratings.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-ratings.test.ts` |
| 18 | `getSupplierRatings` resolve mock supplier, null utk supplier tak dikenal | tests/unit/supplier-ratings.test.ts | unit | PASS | ditto |
| 19 | `ratingBarsFor` 5 baris, pct ∈ [0,100], Σ count == total | tests/unit/supplier-ratings.test.ts | unit | PASS | ditto |
| 20 | Halaman reputasi: nama supplier, rata-rata "4,0", "25 ulasan" | `tests/components/SupplierReviewsClient.test.tsx` | component | PASS | ditto |
| 21 | Distribusi per bintang (group + 5 listitem ber-label) | tests/components/SupplierReviewsClient.test.tsx | component | PASS | ditto |
| 22 | Ulasan terbaru: nama pembeli & komentar dirender | tests/components/SupplierReviewsClient.test.tsx | component | PASS | ditto |
| 23 | Badge: rata-rata "4,0" + "(25 ulasan)" + label "Rating 4,0 dari 5" | `tests/components/SupplierRatingBadge.test.tsx` | component | PASS | `npx vitest run tests/components/SupplierRatingBadge.test.tsx` |
| 24 | Badge tanpa rating → empty-state "Belum ada penilaian" | tests/components/SupplierRatingBadge.test.tsx | component | PASS | ditto |

## Verifikasi seluruh suite (non-live)
```
Test Files  41 passed (41)
     Tests  617 passed (617)
```

## Coverage dan gap yang diketahui
- Data layer rating/supplier tercakup unit test (33 kasus); perilaku UI (gate form, distribusi, badge) tercakup component test jsdom (12 kasus).
- Pemanggilan **API/backend** (persist ke tabel `ratings`, escrow release) belum dirender — basis-UI statis; API route + integrasi live dilakukan pada iterasi berikutnya oleh role backend.
- Komentar disimpan sebagai string mentah tanpa sanitasi HTML di sisi render (hanya teks `{note.comment}` — aman dari XSS di React); kebijakan moderasi di luar cakupan PRD 2.2.6.
- Verifikasi aksesibilitas hanya melalui atribut semantik + RTL role queries; audit WCAG penuh (mis. kontras) termasuk poin polish selanjutnya.

## Merge evidence
RED/GREEN ringkasan di atas sudah dicatat per task. `npm run lint`, `npm run build`, dan `npm test` (non-live) bersih sebelum merge; satu kegagalan live (enum `audit_action` pada DB live telah bertambah nilai `create_batch`/`update_batch`/`delete_batch` di luar ekspektasi test) adalah **regresi pra-eksisting** yang tidak terkait fitur ini.