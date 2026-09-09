# Supplier Registration Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memulihkan pendaftaran Supplier agar konfigurasi server tervalidasi, setiap tahap kegagalan dapat didiagnosis di server, dan registrasi sukses membuat auth user, profile, foto usaha, serta supplier profile berstatus pending.

**Architecture:** Pertahankan orkestrasi registrasi di `registerSupplier` dengan dependency injection dan rollback yang sudah ada. Tambahkan resolver konfigurasi admin yang dapat diuji, error bertahap untuk lookup/signup/upload/insert, serta respons API aman; secret Supabase tetap hanya berada di environment lokal/deployment dan tidak pernah masuk repository.

**Tech Stack:** Next.js 16.2 App Router, TypeScript, Supabase Auth/Postgres/Storage, Vitest 4, Playwright.

**Spec:** `prd/PRD.md`; `docs/testing/role2-final-gate.tdd.md`

## Global Constraints

- Jangan mengubah atau commit dokumen di `prd/`.
- Jangan commit `.env`, `.env.local`, service-role key, secret key, access token, atau database URL.
- Seeder `scripts/seed-demo-users.mjs` tidak menjadi prasyarat registrasi Supplier.
- Database tanpa user atau supplier row harus menerima registrasi pertama bila schema dan environment valid.
- Profile baru tetap ber-role `umkm` sampai supplier disetujui Admin; `supplier_profiles.verification_status` mulai dari `pending`.
- Detail internal hanya dicatat server-side; UI menerima pesan Indonesia yang aman dan kode error stabil.
- Uji live yang membuat auth user atau object Storage memerlukan persetujuan eksplisit dan akun email tester yang sah.
- Jalankan test terlebih dahulu, lalu implementasi minimal, verifikasi, dan commit kecil.

## Known Evidence

- `.env` lokal memiliki Supabase URL dan publishable key, tetapi `SUPABASE_SECRET_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` belum terisi.
- `getAdminClient()` melempar error sebelum lookup email ketika kedua admin key tidak tersedia.
- Route saat ini menangkap semua error tersebut dan mengubahnya menjadi HTTP 500 dengan `Pendaftaran belum dapat diproses. Coba lagi.` tanpa log tahap kegagalan.
- Migration Supplier, profile email lookup, dan storage bucket sudah tercatat pada remote migration history.

## File Map

- Modify: `lib/supabase/admin.ts` — validasi konfigurasi admin yang typed dan dapat diuji.
- Modify: `lib/supplier-registration/service.ts` — error bertahap dan rollback terobservasi.
- Modify: `app/api/suppliers/register/route.ts` — mapping status/kode error dan structured server logging.
- Create: `tests/unit/supabase-admin-config.test.ts` — test konfigurasi secret server.
- Create: `tests/unit/supplier-registration-service.test.ts` — test success dan rollback per tahap.
- Create: `tests/unit/api-supplier-registration.test.ts` — test kontrak response route.
- Create: `docs/testing/supplier-registration-recovery.tdd.md` — bukti RED/GREEN/live.

---

### Task 1: Buat validator konfigurasi Supabase Admin yang typed

**Files:**
- Modify: `lib/supabase/admin.ts`
- Create: `tests/unit/supabase-admin-config.test.ts`

**Interfaces:**
- Consumes: `NodeJS.ProcessEnv` dengan `NEXT_PUBLIC_SUPABASE_URL` dan salah satu dari `SUPABASE_SECRET_KEY` atau `SUPABASE_SERVICE_ROLE_KEY`.
- Produces: `resolveSupabaseAdminConfiguration(env): { url: string; adminKey: string }` atau `SupabaseAdminConfigurationError` dengan `code = "SUPABASE_ADMIN_CONFIG_MISSING"`.

- [ ] **Step 1: Tulis test konfigurasi valid dan invalid**

```ts
import { describe, expect, it } from "vitest";
import {
  resolveSupabaseAdminConfiguration,
  SupabaseAdminConfigurationError,
} from "@/lib/supabase/admin";

describe("resolveSupabaseAdminConfiguration", () => {
  it("rejects a missing server-side admin key", () => {
    expect(() => resolveSupabaseAdminConfiguration({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    })).toThrow(SupabaseAdminConfigurationError);
  });

  it("prefers SUPABASE_SECRET_KEY over the legacy service-role key", () => {
    expect(resolveSupabaseAdminConfiguration({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "secret-current",
      SUPABASE_SERVICE_ROLE_KEY: "secret-legacy",
    })).toEqual({
      url: "https://example.supabase.co",
      adminKey: "secret-current",
    });
  });
});
```

- [ ] **Step 2: Jalankan test dan pastikan RED**

```powershell
npm test -- tests/unit/supabase-admin-config.test.ts
```

Expected: gagal karena resolver dan error class belum tersedia.

- [ ] **Step 3: Implementasikan resolver dan gunakan di `getAdminClient()`**

```ts
export class SupabaseAdminConfigurationError extends Error {
  readonly code = "SUPABASE_ADMIN_CONFIG_MISSING";

  constructor() {
    super("Missing Supabase server-side admin configuration");
    this.name = "SupabaseAdminConfigurationError";
  }
}

export function resolveSupabaseAdminConfiguration(
  env: NodeJS.ProcessEnv,
): { url: string; adminKey: string } {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const adminKey = env.SUPABASE_SECRET_KEY?.trim() ||
    env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !adminKey) throw new SupabaseAdminConfigurationError();
  return { url, adminKey };
}
```

`getAdminClient()` harus memanggil `resolveSupabaseAdminConfiguration(process.env)` dan tetap menggunakan `persistSession: false`, `autoRefreshToken: false`, serta `detectSessionInUrl: false`.

- [ ] **Step 4: Jalankan test dan pastikan GREEN**

```powershell
npm test -- tests/unit/supabase-admin-config.test.ts
```

Expected: seluruh test lulus.

- [ ] **Step 5: Commit validator konfigurasi**

```powershell
git add lib/supabase/admin.ts tests/unit/supabase-admin-config.test.ts
git commit -m "fix(auth): validate supplier admin configuration"
```

### Task 2: Tambahkan error tahap registrasi dan regression test rollback

**Files:**
- Modify: `lib/supplier-registration/service.ts`
- Create: `tests/unit/supplier-registration-service.test.ts`

**Interfaces:**
- Consumes: `RegistrationDependencies` yang sudah mendukung auth signup, profile lookup, Storage upload/remove, supplier profile insert, dan admin delete user.
- Produces: `SupplierRegistrationError` dengan stage `configuration | email_lookup | auth_signup | photo_upload | profile_insert | rollback`.

- [ ] **Step 1: Tulis test happy path dengan dependency injection**

```ts
it("creates auth, uploads the photo, and inserts a pending supplier profile", async () => {
  const dependencies = buildRegistrationDependencies();
  const result = await registerSupplier(validFields(), dependencies);

  expect(result).toEqual({
    ok: true,
    verificationStatus: "pending",
    requiresEmailConfirmation: true,
  });
  expect(dependencies.adminClient.storage.from("wesup-assets").upload)
    .toHaveBeenCalledOnce();
  expect(dependencies.adminClient.from("supplier_profiles").insert)
    .toHaveBeenCalledWith(expect.objectContaining({
      user_id: "11111111-1111-4111-8111-111111111111",
      verification_status: undefined,
    }));
});
```

`validFields()` menggunakan `new File(["RIFFxxxxWEBP"], "business.webp", { type: "image/webp" })`, email normal, password minimal delapan karakter, serta koordinat Bandung yang valid.

- [ ] **Step 2: Tulis test rollback ketika insert supplier profile gagal**

```ts
it("removes the uploaded object and auth user when profile insertion fails", async () => {
  const dependencies = buildRegistrationDependencies({
    insertError: { message: "insert failed" },
  });

  await expect(registerSupplier(validFields(), dependencies)).rejects.toMatchObject({
    name: "SupplierRegistrationError",
    stage: "profile_insert",
  });
  expect(dependencies.remove).toHaveBeenCalledOnce();
  expect(dependencies.deleteUser).toHaveBeenCalledWith(
    "11111111-1111-4111-8111-111111111111",
  );
});
```

- [ ] **Step 3: Jalankan test dan pastikan RED**

```powershell
npm test -- tests/unit/supplier-registration-service.test.ts
```

Expected: gagal karena `SupplierRegistrationError.stage` belum ada.

- [ ] **Step 4: Tambahkan stage dan cause pada error domain**

```ts
export type SupplierRegistrationStage =
  | "configuration"
  | "email_lookup"
  | "auth_signup"
  | "photo_upload"
  | "profile_insert"
  | "rollback";

export class SupplierRegistrationError extends Error {
  constructor(
    readonly stage: SupplierRegistrationStage,
    readonly cause?: unknown,
  ) {
    super(`Supplier registration failed at ${stage}`);
    this.name = "SupplierRegistrationError";
  }
}
```

Gunakan stage yang tepat pada setiap cabang error. Bungkus error `getAdminClient()` sebagai `configuration`; pertahankan cleanup object dan auth user ketika upload atau insert gagal.

- [ ] **Step 5: Jalankan test service dan pastikan GREEN**

```powershell
npm test -- tests/unit/supplier-registration-service.test.ts
```

Expected: happy path dan rollback lulus.

- [ ] **Step 6: Commit service observability**

```powershell
git add lib/supplier-registration/service.ts tests/unit/supplier-registration-service.test.ts
git commit -m "fix(auth): identify supplier registration failure stages"
```

### Task 3: Perbaiki kontrak error route Supplier

**Files:**
- Modify: `app/api/suppliers/register/route.ts`
- Create: `tests/unit/api-supplier-registration.test.ts`

**Interfaces:**
- Consumes: error domain dari `registerSupplier`.
- Produces: 503 `SUPPLIER_REGISTRATION_NOT_CONFIGURED` untuk stage konfigurasi; 500 `SUPPLIER_REGISTRATION_FAILED` untuk kegagalan internal; 409 dan 429 yang sudah ada tetap sama.

- [ ] **Step 1: Tulis test route untuk konfigurasi admin yang hilang**

```ts
it("returns a safe 503 when admin configuration is missing", async () => {
  vi.mocked(registerSupplier).mockRejectedValue(
    new SupplierRegistrationError("configuration"),
  );

  const res = await POST(validRegistrationRequest());

  expect(res.status).toBe(503);
  await expect(res.json()).resolves.toEqual({
    error: "Layanan pendaftaran Supplier belum siap. Hubungi pengelola aplikasi.",
    code: "SUPPLIER_REGISTRATION_NOT_CONFIGURED",
  });
});
```

- [ ] **Step 2: Tulis test route untuk kegagalan upload/insert**

```ts
it("returns a generic 500 without exposing Supabase details", async () => {
  vi.mocked(registerSupplier).mockRejectedValue(
    new SupplierRegistrationError("photo_upload", new Error("bucket missing")),
  );

  const res = await POST(validRegistrationRequest());

  expect(res.status).toBe(500);
  await expect(res.json()).resolves.toEqual({
    error: "Pendaftaran belum dapat diproses. Coba lagi.",
    code: "SUPPLIER_REGISTRATION_FAILED",
  });
});
```

- [ ] **Step 3: Jalankan test dan pastikan RED**

```powershell
npm test -- tests/unit/api-supplier-registration.test.ts
```

Expected: route masih mengembalikan 500 tanpa kode untuk kedua skenario.

- [ ] **Step 4: Tambahkan structured server logging dan mapping status**

```ts
if (error instanceof SupplierRegistrationError) {
  console.error("[supplier/register] registration failed", {
    stage: error.stage,
    cause: error.cause instanceof Error ? error.cause.message : undefined,
  });

  if (error.stage === "configuration") {
    return NextResponse.json(
      {
        error: "Layanan pendaftaran Supplier belum siap. Hubungi pengelola aplikasi.",
        code: "SUPPLIER_REGISTRATION_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      error: "Pendaftaran belum dapat diproses. Coba lagi.",
      code: "SUPPLIER_REGISTRATION_FAILED",
    },
    { status: 500 },
  );
}
```

Unexpected error juga harus di-log server-side dan tetap menghasilkan response aman.

- [ ] **Step 5: Jalankan test route dan komponen form**

```powershell
npm test -- tests/unit/api-supplier-registration.test.ts tests/components/SupplierRegistrationForm.test.tsx
```

Jika nama component test yang tersedia berbeda, gunakan file hasil `rg --files tests | rg "SupplierRegistration"`; jangan membuat duplicate test suite.

Expected: seluruh test lulus dan pesan teknis tidak muncul di payload client.

- [ ] **Step 6: Commit kontrak error route**

```powershell
git add app/api/suppliers/register/route.ts tests/unit/api-supplier-registration.test.ts
git commit -m "fix(auth): expose safe supplier registration failures"
```

### Task 4: Lengkapi secret lokal dan lakukan preflight tanpa membocorkan nilainya

**Files:**
- Local-only: `.env.local` — tidak boleh di-stage atau di-commit.
- Verify: `.gitignore`

**Interfaces:**
- Consumes: secret key server-side dari Supabase project yang sama dengan `NEXT_PUBLIC_SUPABASE_URL`.
- Produces: `getAdminClient()` yang dapat mengakses Auth Admin, Storage, `profiles`, dan `supplier_profiles`.

- [ ] **Step 1: Ambil Secret key dari Supabase Dashboard untuk project yang sama**

Gunakan Project Settings → API Keys → Secret keys. Simpan key aktual sebagai `SUPABASE_SECRET_KEY` di `.env.local`. Bila project hanya menyediakan legacy service-role JWT, simpan sebagai `SUPABASE_SERVICE_ROLE_KEY`. Jangan menyalin key ke chat, source code, test fixture, atau dokumentasi.

- [ ] **Step 2: Verifikasi presence tanpa mencetak nilai**

```powershell
$envLines = Get-Content -LiteralPath ".env.local"
$hasSecret = [bool]($envLines | Where-Object { $_ -match "^SUPABASE_SECRET_KEY=.+" })
$hasLegacy = [bool]($envLines | Where-Object { $_ -match "^SUPABASE_SERVICE_ROLE_KEY=.+" })
"admin-key-configured=$($hasSecret -or $hasLegacy)"
```

Expected: `admin-key-configured=True`.

- [ ] **Step 3: Verifikasi file tetap di-ignore Git**

```powershell
git check-ignore .env.local
git status --short
```

Expected: `.env.local` terdeteksi ignored dan tidak muncul di status.

- [ ] **Step 4: Restart development server**

```powershell
npm run dev
```

Expected: server membaca `.env.local` dan route tidak lagi berhenti pada stage `configuration`.

### Task 5: Jalankan smoke test registrasi Supplier dengan cleanup terkontrol

**Files:**
- Create: `docs/testing/supplier-registration-recovery.tdd.md`
- Test: `tests/e2e/supplier-flow.spec.ts`

**Interfaces:**
- Consumes: satu email tester baru yang dapat menerima email konfirmasi dan satu foto WebP valid maksimal 10 MB.
- Produces: auth user, `profiles` row, Storage object, dan `supplier_profiles` row pending; cleanup dijalankan hanya bila pemilik meminta data test dihapus.

- [ ] **Step 1: Pastikan objek schema yang dibutuhkan tersedia**

Verifikasi secara read-only melalui database bahwa `public.profiles.email`, `public.supplier_profiles`, trigger `on_auth_user_created`, dan bucket `wesup-assets` tersedia. Jangan menjalankan seed.

- [ ] **Step 2: Daftar melalui `http://localhost:3000/supplier/register`**

Isi seluruh langkah form dengan email tester baru, nomor WhatsApp valid, lokasi Bandung, password minimal delapan karakter, dan foto WebP valid. Submit satu kali.

Expected: HTTP 201 dan dialog sukses dengan `verificationStatus: pending`.

- [ ] **Step 3: Verifikasi empat efek samping secara read-only**

- `auth.users`: user baru ditemukan dengan email tester.
- `public.profiles`: row memiliki email normalized dan role `umkm`.
- `public.supplier_profiles`: row memiliki `verification_status = 'pending'`.
- Storage `wesup-assets`: object berada di `business/<user-id>/<uuid>.webp`.

- [ ] **Step 4: Verifikasi duplicate-email path**

Submit ulang dengan email tester yang sama.

Expected: HTTP 409 dan pesan `Email sudah digunakan.`; tidak ada object Storage atau auth user tambahan.

- [ ] **Step 5: Catat bukti tanpa PII atau secret**

Isi `docs/testing/supplier-registration-recovery.tdd.md` dengan status HTTP, nama stage, jumlah row relatif, dan hasil cleanup. Jangan menulis email lengkap, user UUID, storage path lengkap, token, atau key.

- [ ] **Step 6: Commit dokumentasi verifikasi**

```powershell
git add docs/testing/supplier-registration-recovery.tdd.md
git commit -m "docs(auth): record supplier registration recovery"
```

### Task 6: Jalankan final gate dan publish branch

**Files:**
- Verify only: seluruh file Supplier registration yang berubah.

**Interfaces:**
- Consumes: konfigurasi lokal valid, test hijau, dan bukti smoke test.
- Produces: branch `marketplace` siap di-pull tanpa secret atau data test sensitif.

- [ ] **Step 1: Jalankan test lengkap**

```powershell
npm test
```

Expected: tidak ada test gagal.

- [ ] **Step 2: Jalankan lint dan build**

```powershell
npm run lint
npm run build
```

Expected: 0 error dan build selesai.

- [ ] **Step 3: Audit secret dan diff**

```powershell
git status --short
git diff --check
git diff --stat origin/marketplace...HEAD
git grep -n "SUPABASE_SECRET_KEY=" -- ':!*.example' ':!docs/superpowers/plans/*'
```

Expected: grep tidak menemukan nilai secret; `.env.local` tidak muncul di status.

- [ ] **Step 4: Push branch**

```powershell
git push origin marketplace
```

Expected: `origin/marketplace` menunjuk commit recovery terbaru.

## Execution status — 2026-09-08

Implemented locally: Tasks 1–3 (typed admin configuration validation, stage-aware service errors and rollback tests, and safe route responses). Task 4 requires the deployment owner to supply an admin key in `.env.local`; Task 5 was not run because it creates a real Auth user and Storage object and needs explicit approval. Evidence is recorded in `docs/testing/supplier-registration-recovery.tdd.md`.