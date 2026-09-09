# Registration Integrity Gatekeeper — TDD Evidence

Tanggal verifikasi: 2026-08-31

## Scope

Menutup celah TOCTOU pada alur "Daftar" UMKM (PRD 3.1/3.2) dan mengeraskan batas
integritas di lapisan database sebelum live integration suite di-deploy.

1. **DB-boundary Gatekeeper** — trigger `prevent_registration_outside_window`
   (`BEFORE INSERT` pada `registrations`) yang memastikan baris hanya boleh masuk
   ketika batch masih `published` DAN `now()` berada dalam jendela
   `[registration_opens_at, registration_closes_at)`. Gate check dan insert berjalan
   dalam satu transaksi, sehingga race terhadap `cut_off_batch()` (yang mengganti
   status menjadi `closed`) tertutup di level database, bukan hanya di API route.
2. **Overflow guard** — `cut_off_batch()` kini mengunci invoice dengan
   `final_amount = round(least(v_tier.price_per_unit * quantity, 9999999999.99), 2)`
   sehingga satu order raksasa tidak menggagalkan cutoff seluruh batch
   (`numeric(12,2)` overflow).
3. **Validasi input route** — `POST /api/registrations` menolak quantity yang bukan
   safe integer (`Number.isSafeInteger`) dan mendeteksi duplikat via kode
   PostgreSQL `23505` (dengan fallback pesan `/duplicate/i`), agar counter Redis
   di-rollback (`decr`) dengan benar.
4. **RLS eksplisit** — policy `registrations_umkm_all` di-drop & dibuat ulang dengan
   `WITH CHECK (umkm_id = auth.uid())` eksplisit (sebelumnya hanya USING; PostgreSQL
   sudah memperlakukan USING sebagai WITH CHECK untuk INSERT, ini klarifikasi saja).

Keputusan penting (dari review): **tidak** ada quantity cap — hanya overflow guard;
rate limiter **tetap fail-open**.

## RED/GREEN Evidence

### Task 1 — unit route `api-registrations`

RED: `tests/unit/api-registrations.test.ts` ditulis/diubah duluan — kasus
`rejects a non-safe-integer quantity before touching Redis` gagal (route menerima
`9007199254740993` karena `Number.isInteger` tidak cukup):

```text
npx vitest run tests/unit/api-registrations.test.ts
FAIL ... rejects a non-safe-integer quantity before touching Redis
AssertionError: expected 201 to be 400
```

Plus kasus duplikat diganti jadi dua: berbasis `code: "23505"` dan fallback pesan.

GREEN setelah route memakai `Number.isSafeInteger` + `isDuplicateKeyError()`:

```text
npx vitest run tests/unit/api-registrations.test.ts
Test Files  1 passed (1)   Tests  14 passed (14)
```

### Task 2 — migrasi trigger + overflow guard + schema contract

RED: `tests/migrations/registration-integrity.test.ts` (baru) dan pembaruan
`tests/migrations/cutoff-gatekeeper.test.ts` (`final_amount` regex `least(...)`)
gagal sebelum migrasi `20260831010000_registration_integrity.sql` ditulis.
`schema.test.ts` juga RED karena `prevent_registration_outside_window`
ditambahkan ke `REQUIRED_TRIGGERS`/`REQUIRED_FUNCTIONS`.

GREEN setelah migrasi ditulis (parsable oleh `pgsql-ast-parser`, seluruh contract
171 test tidak rusak):

```text
npx vitest run tests/migrations/registration-integrity.test.ts \
  tests/migrations/cutoff-gatekeeper.test.ts tests/migrations/schema.test.ts
Test Files  3 passed (3)   Tests  189 passed (189)
```

## Test results (final)

```text
npm test
Test Files  ... passed
Tests       ... passed
```

## Deploy & reconciliation (2026-08-31, live)

Remote `woxgghuoeljagnkldqtf` (`WeSup`) berada di lineage migrasi yang BEDA
dari lokal (ada lintas nama `batch_status_extensions`, `supplier_batch_crud`,
`umkm_registration_contract` dst.), sehingga `supabase db push` tidak cukup.
Alur deploy yang dipakai:

1. `scripts/backup-public-data.mjs` → snapshot `public` (urutan FK-topo,
   `::timestamptz`/`::jsonb` cast).
2. `scripts/replay-public-schema.mjs` → reset `public` + replay 16 migrasi lokal
   + restore seed. **Deviasi yang didokumentasikan:** DDL `storage.objects`
   (RLS enable + policies) dari `20260731000900_storage_buckets.sql` di-skip saat
   replay — di cloud Supabase tabel tsb di-owner `supabase_storage_admin` dan
   `postgres` tidak bisa `SET ROLE` ke owner-nya (terverifikasi empiris). Skip
   dicatat per-file. Kebijakan lama `storage_objects_products_select` tetap ada;
   bucket privat tetap deny-by-default.
3. Hasil: 16 migrasi ter-replay + ter-record; live integration suite (249 test)
   **hijau penuh** setelah dua penyesuaian contract (bawah).

### Insiden snapshot (transparansi)

Snapshot asli `scripts/backups/public-seed-20260831.sql` (memuat 22 profil,
5 `supplier_profiles`, 1 `umkm_profiles`, 3 batch, tier/timeline, audit log)
**tertimpa** saat regenerasi dilakukan setelah reset `public` (DB sudah kosong),
JADI data non-`auth` tersebut tidak terdorong kembali. Cloud backup tidak ada
(`backups: []`, `pitr: false`). Pemulihan yang dilakukan:

- `scripts/restore-profiles-from-auth.mjs` → 22 `profiles` dibangun ulang
  dari `auth.users` (id, email, `full_name`, `phone`, `created_at`); role/status
  memakai default schema (`umkm`/`active`).
- `scripts/backups/public-seed-20260831-reconstructed.sql` → snapshot utuh
  baru (22 profil + sisa audit log dari live tests) untuk referensi.
- Data supplier/batch/payment lama tidak dapat direkonstruksi; demo di-reseed
  lewat alur aplikasi.

### Perubahan contract yang menyertai deploy

1. **`supplier_profiles.nik` NOT NULL** — dihapus dari `notNull` pada
   `tests/helpers/schema-contract.ts`. Migration 0011
   (`20260819000000_supplier_registration.sql`) sengaja menjadikan `nik` dan
   `ktp_photo_url` nullable ("KTP/NIK remain nullable until the Admin KYC step");
   contract lama menuntut NOT NULL dan baru tersingkap setelah replay memakai
   lineage lokal yang benar.
2. **Duplikat registrasi** — test live
   `rejects duplicate (batch_id, umkm_id) registration (UNIQUE)` kini membuat
   batch `published` + timeline jendela terbuka (via transaksi fixture dengan
   trigger bypass) baru menguji `23505`, karena gatekeeper `P0001` berjalan
   lebih dulu untuk batch tertutup.
3. **`cancellation-search`** — fixture historis (jendela registrasi sudah tutup)
   memakai `set session_replication_role = replica` untuk insert fixture saja,
   sambil tetap menguji alur cancel/refund/search.

## Final state

Live DB: schema 16 migrasi lokal, 22 profil ter-rekonstruksi. `npm test` = 28
file, 696 test hijau (termasuk live). `npm run lint` 0 error, `npm run build`
sukses.

## Akhirnya: `migration 0016` harus di-deploy ke live Supabase

`prevent_registration_outside_window` masuk `REQUIRED_FUNCTIONS` +
`REQUIRED_TRIGGERS`, jadi `tests/live/database.integration.test.ts` hanya lulus
setelah `supabase db push` migrasi `20260831010000_registration_integrity.sql`
ke database target — menandakan batas DB boundary ini live (pola sama seperti
`cut_off_batch` kemarin).