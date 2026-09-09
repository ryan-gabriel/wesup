# TDD Evidence Report — Supplier Flow E2E (Playwright / msedge)

## Source plan
Melengkapi verifikasi end-to-end atas perbaikan **flow & navigasi** Supplier. Sesuai keputusan pengguna,
browser E2E menggunakan **Edge sistem** (`channel: 'msedge'`) sehingga **tidak ada unduhan binary
Playwright** — memakai `msedge.exe` yang sudah ada di sistem operasi.

Ruang lingkup E2E:
1. Navigasi publik: halaman yang direferensikan NavigationBar (`/pesanan`, `/notifikasi`, `/akun`) memuat
   tanpa 404, dengan NavigationBar terlihat, plus `/marketplace` & `/login`.
2. Pendaftaran publik: `/supplier/register` bisa diakses tanpa auth.
3. **Guard keamanan:** kunjungan **tanpa login** ke halaman dasbor `/supplier/*` harus dialihkan ke
   `/login` (guard `requireRole(["supplier"])` terbukti bekerja di browser nyata), bukan bocor ke dashboard.

## Scope boundary (penting — keputusan pengguna)
Halaman dasbor `Supplier` berjalan di atas **mock data** (belum wire ke DB) dan kini **diguard** oleh
`app/supplier/(dashboard)/layout.tsx` via `requireRole(["supplier"])`. Menjelajahi dashboard mock yang
**terautentikasi** memerlukan sesi Supabase nyata — di luar lingkup selama halaman masih mock
("flow & navigasi dulu, jangan wire ke DB"). Oleh karena itu E2E sengaja memverifikasi:
- alur publik (no-404 + nav), dan
- **efek guard**: tanpa sesi, `/supplier/*` → `/login`.
Ini sudah terbukti deterministik tanpa kredensial, dan menjadi jembatan menuju E2E terautentikasi
(storageState) setelah data di-wire ke DB.

## Test specification — E2E (`tests/e2e/supplier-flow.spec.ts`)

| # | Yang dijamin | Hasil | Evidence |
|---|--------------|-------|----------|
| 1 | Halaman landing `/` memuat tanpa 404 | PASS | `npm run test:e2e` |
| 2 | `/pesanan`, `/notifikasi`, `/akun` memuat, memberi heading benar, **tanpa 404**, dan NavigationBar terlihat | PASS | `npm run test:e2e` |
| 3 | `/marketplace` memuat tanpa 404 | PASS | `npm run test:e2e` |
| 4 | `/login` merender form (heading "Masuk") | PASS | `npm run test:e2e` |
| 5 | `/supplier/register` dapat diakses publik (heading pendaftaran) tanpa 404 | PASS | `npm run test:e2e` |
| 6 | `/supplier` (tanpa auth) dialihkan ke `/login` | PASS | `npm run test:e2e` |
| 7 | `/supplier/catalog` (tanpa auth) → `/login` | PASS | `npm run test:e2e` |
| 8 | `/supplier/catalog/new` (tanpa auth) → `/login` | PASS | `npm run test:e2e` |
| 9 | `/supplier/recurring` (tanpa auth) → `/login` | PASS | `npm run test:e2e` |
| 10 | `/supplier/batch/batch-active-001` (tanpa auth) → `/login` | PASS | `npm run test:e2e` |
| 11 | `/supplier/akun/escrow` & `/supplier/akun/laporan` (tanpa auth) → `/login` | PASS | `npm run test:e2e` |

## Verifikasi seluruh suite E2E
```
Running 11 tests using 1 worker
  11 passed (25.9s)
```
Command: `npm run test:e2e` (alias `playwright test`), config `playwright.config.ts`.

## Konfigurasi
- `playwright.config.ts` — `testDir: ./tests/e2e`, `baseURL: http://localhost:3100`,
  `channel: "msedge"`, `headless: true`, worker tunggal, `webServer` otomatis menjalankan
  `npm run dev -- --port 3100`.
- `package.json` — skrip baru `"test:e2e": "playwright test"`; `@playwright/test` di `devDependencies`.
- `.gitignore` — menambahkan `/test-results/`, `/playwright-report/`, `/blob-report/`, `/playwright/.cache/`.

## Coverage dan gap yang diketahui
- **Tidak terautentikasi:** traversal dasbor Supplier yang terautentikasi (klik flow lengkap
  catalog → batch → orders → pickup → recurring → akun) belum tercakup karena dashboard masih mock dan
  diguard; memerlukan storageState dengan sesi Supabase nyata setelah wire ke DB. Ditandai sebagai
  iterasi lanjutan.
- **Guard bawaan:** justru dibuktikan E2E (test #6–#11) bahwa tanpa sesi, halaman Supplier tidak bocor —
  nilai keamanan tambahan dari suite ini.
- Rendering leaflet pada `/supplier/register` tidak diverifikasi interaksi (klik peta) pada putaran ini;
  hanya load halaman + no-404.

## Merge evidence
RED/GREEN tercatat (11/11 hijau). Artifak `trace.zip` E2E otomatis disimpan hanya saat `retain-on-failure`,
dan folder hasil dibersihkan serta di-ignore.
