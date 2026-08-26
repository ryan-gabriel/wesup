# Role-Aware Login TDD Evidence

Tanggal verifikasi: 2026-08-20

## Scope

Verifikasi mencakup kontrak payload login, validasi selected role, autentikasi password melalui Supabase SSR, pemeriksaan `profiles.role`/`profiles.status`, status verifikasi supplier, cleanup sesi pada error, UI `/login`, dan regresi auth yang sudah ada.

Tidak ada secret, password, atau kredensial Supabase yang dicatat dalam dokumen ini.

## RED/GREEN Evidence

### Task 1 — contract

RED:

```text
npm test -- tests/unit/login-contract.test.ts
FAIL: Cannot find package '@/lib/auth/login-contract'
```

GREEN:

```text
npm test -- tests/unit/login-contract.test.ts
Test Files  1 passed (1)
Tests       6 passed (6)
```

### Task 2 — API role/status

RED:

```text
npm test -- tests/unit/api-login.test.ts
Test Files  1 failed (1)
Tests       11 failed (11)
```

Kegagalan sesuai ekspektasi: Route Handler lama belum menerima role, belum memuat profil, dan masih meneruskan pesan mentah Supabase.

GREEN:

```text
npm test -- tests/unit/api-login.test.ts
Test Files  1 passed (1)
Tests       11 passed (11)

npm test -- tests/unit/api-auth.test.ts tests/unit/api-login.test.ts
Test Files  2 passed (2)
Tests       39 passed (39)
```

### Task 3 — UI

Lint:

```text
npm run lint
exit code 0
```

Runtime smoke check:

```text
GET http://127.0.0.1:3000/login
status=200
containsLoginHeading=True
containsRoleLabel=True
```

## Regression Results

Unit suite:

```text
npm test -- tests/unit
Test Files  12 passed (12)
Tests       165 passed (165)
```

Full suite:

```text
npm test
Test Files  2 failed | 15 passed (17)
Tests       2 failed | 562 passed (564)
```

Dua kegagalan berada pada live integration yang tidak terkait perubahan login:

1. `tests/live/auth-rls.integration.test.ts`: RPC `approve_supplier` mengembalikan status HTTP 300, sedangkan test mengharapkan minimal 400.
2. `tests/live/database.integration.test.ts`: database development masih menganggap `supplier_profiles.nik` nullable, sedangkan kontrak test mengharapkan NOT NULL.

Build:

```text
npm run build
Compiled successfully
Failed to type check:
./sdd-current/app/page.tsx:13:31
Cannot find module '@/components/landing/BatchMagnetLoader'
```

`sdd-current/` sudah ada sebagai perubahan workspace di luar scope login dan tidak disentuh.

## Manual QA Checklist

- [x] `/login` merespons 200.
- [x] Heading `Masuk ke akun Anda` muncul.
- [x] Selector role Admin, UMKM, dan Supplier dirender.
- [x] Tema halaman menggunakan gradien/kartu biru yang konsisten dengan register.
- [x] Password memiliki tombol tampil/sembunyikan.
- [x] API tidak meneruskan pesan kredensial mentah.
- [x] Role mismatch, supplier pending/rejected, dan status nonaktif memanggil `signOut()`.
- [x] Login sukses mengembalikan `profile` dan `redirectTo: "/"`.
- [x] Tidak ada migration, RLS, atau perubahan `proxy.ts`.
