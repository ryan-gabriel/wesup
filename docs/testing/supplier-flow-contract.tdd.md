# TDD Evidence Report — Supplier Dashboard Flow & Navigasi (PRD 2.1.5 Dasbor Manajemen UMKM)

## Source plan
Pekerjaan ini memperbaiki **alur & navigasi** pada dasbor Supplier setelah audit click-path menemukan
sejumlah halaman yang belum ada (rute `/pesanan`, `/notifikasi`, `/akun` menuju 404) dan navigasi utama
yang belum terpasang di halaman, serta menutup celah keamanan routing. Sesuai keputusan pengguna:
- Fokus "flow & navigasi dulu" — halaman tetap berbasis mock data (belum wire ke DB).
- Tulis **file test** + **evidence TDD** (override keputusan ringkasan-chat sebelumnya).
- Browser E2E memakai **Edge/Chrome sistem** (`channel: 'msedge'`), tanpa unduh binary baru.

Ruang lingkup lisensi: guard/routing peran, daftar-rute flow-contract, perbaikan tautan (breadcrumb,
tautan cepat pesanan, tombol Batal), placeholder halaman publik, dan wiring navigasi utama.

## User journeys
- Sebagai Supplier, saya ingin rute `/pesanan`, `/notifikasi`, `/akun` tidak lagi 404 sehingga navigasi
  utama tidak putus ketika saya menekan ikon di NavigationBar.
- Sebagai pengguna yang **belum login / bukan Supplier**, saya tidak boleh mengakses halaman dasbor
  `/supplier/*`; saya harus dialihkan ke `/login` (guard peran).
- Sebagai Supplier yang login, saya langsung diarahkan ke `/supplier` setelah masuk (bukan landing publik).
- Sebagai pengguna di halaman aplikasi, saya harus melihat NavigationBar agar bisa bernavigasi antar fitur.

## Task report
Ikuti alur TDD (RED → GREEN). Konfigurasi Vitest berjalan di `environment: "node"` (tanpa jsdom/RTL),
sehingga strategi (konsisten `supplier-fulfillment-ui.tdd.md`, strategi B1) adalah **unit test pada logika
murni / kontrak** + **rute statis nyata** (rotasi build), sementara perilaku browser diverifikasi lewat
Playwright (`tests/e2e/supplier-flow.spec.ts`) dan `npm run build`.

### Task: guard & routing peran
- **Ringkasan:** Pindahkan halaman dasbor Supplier ke route-group `app/supplier/(dashboard)/` (URL tetap
  `/supplier/*`) agar `/supplier/register` tetap publik; tambahkan guard layout yang memanggil
  `getServerClient()` + `requireRole(["supplier"])`, `AuthError` 401 → `redirect("/login")`, selainnya
  → `redirect("/")`.
- **File produksi:** `app/supplier/(dashboard)/layout.tsx`, `lib/auth/login-contract.ts`
- **File test:** `tests/unit/login-contract.test.ts` (diekstensi), `tests/unit/supplier-flow-contract.test.ts`
- **Validation command:** `npx vitest run tests/unit/supplier-flow-contract.test.ts tests/unit/login-contract.test.ts`

**RED — sebelum guard/navigasi di-wire:** rute `/supplier/*` tidak diguard dan halaman `/pesanan` dst tidak ada.

**GREEN — setelah implementasi:**
```
Test Files  2 passed (2)
     Tests  24 passed (24)
```

### Task: placeholder halaman publik + navigasi utama
- **Ringkasan:** Buat halaman `/pesanan`, `/notifikasi`, `/akun` (mencegah 404) dan pasang `Layout`
  (NavigationBar + Footer) pada ketiganya agar NavigationBar benar-benar ter-*render* (sebelumnya hanya
  didefinisikan, tidak pernah dipakai halaman manapun).
- **File produksi:** `app/pesanan/page.tsx`, `app/notifikasi/page.tsx`, `app/akun/page.tsx`
- **File test:** `tests/e2e/supplier-flow.spec.ts` (no-404 + nav terlihat)

### Task: perbaikan tautan flow
- `components/supplier/report/ReportFormClient.tsx` — tombol "Batal" diarahkan ke
  `/supplier/akun/laporan/riwayat` (sebelumnya salah `/supplier/akun/rekening`).
- `components/supplier/fulfillment/PickupScannerClient.tsx` — kartu duplikat "Siap Dinilai" diganti
  "Total Pesanan" (`state.orders.length`).
- `components/supplier/recurring/RecurringForm.tsx` — tambah `focusFirstError()` (meniru
  `CreateCatalogForm`), `id="tpl-tiers"`, dan pulihkan `id="tpl-coordinate"`.

## Test specification — unit flow-contract

| # | Yang dijamin | Test file | Test type | Hasil | Evidence |
|---|--------------|-----------|-----------|-------|----------|
| 1 | Login Supplier diarahkan ke `/supplier` (bukan `/`) | `tests/unit/api-login.test.ts` | unit | PASS | `npx vitest run tests/unit/api-login.test.ts` |
| 2 | Rute publik supplier `/pesanan`, `/notifikasi`, `/akun` tersedia | `tests/unit/supplier-flow-contract.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-flow-contract.test.ts` |
| 3 | Rute dasbor `/supplier/*` tercantum & dapat di-resolve nav | `tests/unit/supplier-flow-contract.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-flow-contract.test.ts` |
| 4 | Guard layout menuntut peran `supplier` (redirect 401 → `/login`) | `tests/unit/login-contract.test.ts` | unit | PASS | `npx vitest run tests/unit/login-contract.test.ts` |
| 5 | NavigationBar href memetakan ke rute yang ada (tidak putus) | `tests/unit/supplier-flow-contract.test.ts` | unit | PASS | `npx vitest run tests/unit/supplier-flow-contract.test.ts` |

## Verifikasi seluruh suite (unit + build)
```
Test Files  24 passed (24)
     Tests  293 passed (293)
```

`npm run build` — hijau; seluruh rute `/supplier/*` (tanpa perubahan URL) + `/pesanan`, `/notifikasi`,
`/akun` + `/supplier/register` tercantum di route tree.

`npx eslint app/** tests/unit/supplier-flow-contract.test.ts playwright.config.ts ...` — **0 error**
(hanya 1 warning pra-ada `Users` unused di `app/page.tsx`, tidak menyentuh area ini).

## Coverage dan gap yang diketahui
- Unit coverage berjalan di lingkungan `node` (tanpa jsdom) sehingga perilaku **rendering UI** tidak
  di-cover otomatis (strategi B1).
- Traversal browser nyata di-cover oleh `tests/e2e/supplier-flow.spec.ts` (semua hijau, 11 kasus).
- **Gap tertutup selama pengerjaan:** NavigationBar awalnya tidak terpasang di halaman manapun —
  diverifikasi E2E, ditemukan, lalu di-wire ke ketiga placeholder. Dasbor `/supplier/*` belum memakai
  `Layout` karena sudah memiliki guard layout sendiri; pemasangan navigasi pada halaman Supplier tercatat
  sebagai iterasi lanjutan (butuh kutipan pada `(dashboard)/layout.tsx` yang tetap kompatibel dengan
  `requireRole`).

## Merge evidence
RED/GREEN ringkasan dicatat di atas. Tidak ada squash pada cabang tugas ini (mengikuti pola dokumen
TDD sebelumnya). Artifak Playwright (`test-results/`, `playwright-report/`, `playwright/.cache/`)
dimasukkan ke `.gitignore` agar tidak ter-commit.
