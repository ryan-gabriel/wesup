# Dynamic Marketplace Integration — TDD Evidence

Tanggal verifikasi: 2026-09-08

## Tahap 3 — Listing dari read model Supabase

### RED

Kontrak baru pada `tests/unit/api-marketplace-search.test.ts` mengharuskan
response canonical (`supplierName`, `registeredQuantity`, `tiers`,
`registrationClosesAt`, `origin`, `pageSize`, dan `totalPages`) serta forwarding
`minPrice`/`maxPrice`. Implementasi lama masih mengembalikan raw RPC rows dan
tidak memiliki parameter harga.

### GREEN

Route search sekarang memvalidasi filter harga, menentukan origin UMKM/request/
Bandung, memanggil read-model RPC, dan memetakan row ke `MarketplaceItem`.
Repository client menggunakan fetch abortable dengan `cache: "no-store"`.
Migration read model menambahkan `search_batches` dan `get_marketplace_batch`
sebagai `security definer` dengan `set search_path = public`; keduanya hanya
mengembalikan batch `published` dan agregat quantity untuk status live.

```text
npm test -- tests/migrations/schema.test.ts tests/migrations/marketplace-read-model.test.ts tests/unit/api-marketplace-search.test.ts tests/unit/marketplace-api-repository.test.ts
Test Files  4 passed (4)
Tests       203 passed (203)
```

## Keputusan desain

- `origin` memakai koordinat eksplisit request jika diberikan, profil UMKM jika
  tersedia, atau Bandung sebagai fallback; listing dan peta memakai sumber yang
  sama.
- Jarak dan estimasi pickup yang tidak valid menjadi `null`, bukan angka palsu.
- `current_price_per_unit` memakai tier dengan `min_volume` tertinggi yang
  sudah tercapai dan fallback Tier 1; tier adalah threshold harga, bukan kuota
  kumulatif.
- RPC bersifat security-definer karena RLS registrasi melarang pembaca publik
  melihat baris UMKM lain. Respons hanya agregat.

## Tahap 4 — Detail UUID dan Share WhatsApp canonical

### RED/GREEN

Test baru membuktikan UUID invalid → 400, item read model kosong → 404,
kesalahan RPC → 500, serta forwarding koordinat viewer. Test share membuktikan
URL absolut memakai origin deployment dan menghapus query/hash termasuk `ref`
dan `utm_*` sebelum masuk ke pesan WhatsApp.

```text
npm test -- tests/unit/api-marketplace-detail.test.ts tests/unit/marketplace-share-link.test.ts tests/components/MarketplaceDetailClient.test.tsx tests/components/ProductCard.test.tsx
Test Files  4 passed (4)
Tests       47 passed (47)
```

Halaman detail memakai `/marketplace/[id]`, kartu memakai UUID batch, dan route
slug statis tidak lagi menjadi jalur production. `NEXT_PUBLIC_SITE_URL` menjadi
sumber canonical URL; hanya development/test yang memakai localhost.

## Tahap 5 — Join Batch dan progress tier real-time

### RED

Kontrak komponen pada `tests/components/JoinBatchForm.test.tsx`,
`tests/components/TierProgressBar.test.tsx`, dan `tests/unit/use-tier-progress.test.ts`
mengharuskan POST quantity + consent coordinates, error 409/network yang bisa
diulang, progress ARIA, polling visible empat detik, refetch focus, serta
retensi snapshot terakhir saat API gagal.

### GREEN

`JoinBatchForm` sekarang memanggil `POST /api/registrations` dengan UUID batch,
jumlah porsi, dan koordinat consent opsional. Respons sukses langsung
memanggil callback detail dan menampilkan tautan Pesanan; tidak ada lagi
redirect palsu. `useTierProgress` mengambil `/api/batches/:id/progress`,
membersihkan AbortController/listener, berhenti saat status batch tertutup atau
cutoff terlewati, dan menghitung ulang tier setelah registrasi sukses.

```text
npm test -- tests/components/MarketplaceDetailClient.test.tsx tests/components/MarketplaceDetailLiveJoin.test.tsx tests/components/JoinBatchForm.test.tsx tests/components/TierProgressBar.test.tsx tests/unit/use-tier-progress.test.ts
Test Files  5 passed (5)
Tests       38 passed (38)
```

## Tahap 6 — Peta radius tersinkron

`MarketplaceRadiusMap` merender pusat pencarian, lingkaran radius dalam meter,
dan marker pickup yang koordinatnya valid. `MarketplaceRadiusMapClient` memakai
dynamic import `ssr: false`; radius pencarian didebounce 400 ms sebelum request
API, sementara lingkaran peta mengikuti nilai slider yang sedang dipilih.

```text
npm test -- tests/components/MarketplaceRadiusMap.test.tsx
Test Files  1 passed (1)
Tests       2 passed (2)
```

## Tahap 7 — Loading, empty, error dan gate verifikasi

Route marketplace dan detail memiliki skeleton boundary; error boundary
menyediakan pesan aman dan tombol retry. `MarketplaceResults` mempertahankan
kontrak empty/error state dan `aria-busy` untuk pembaca layar.

```text
npm test
Test Files  55 passed | 4 skipped (59)
Tests       688 passed | 244 skipped (932)

npm run lint
0 errors; 10 pre-existing warnings
```

`npm run build` berhasil compile dan type-check, tetapi pengumpulan page data di
environment ini berhenti karena credential Supabase tidak tersedia
(`NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
