# Marketplace API Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memulihkan halaman Marketplace agar `/api/marketplace/search` selalu mengembalikan kontrak yang valid dan database kosong tampil sebagai Empty State, bukan `Internal server error`.

**Architecture:** Pertahankan kontrak read model dinamis dengan RPC `search_batches` sembilan parameter sebagai satu-satunya sumber listing. Sinkronkan schema remote melalui migration resmi, lalu tambahkan klasifikasi error server-side agar schema drift menghasilkan respons aman dan dapat didiagnosis tanpa membocorkan detail Supabase ke browser.

**Tech Stack:** Next.js 16.2 App Router, TypeScript, Supabase Postgres/PostgREST, Vitest 4, Playwright.

**Spec:** `prd/PRD.md`; `docs/testing/marketplace-dynamic-integration.tdd.md`

## Global Constraints

- Jangan mengubah atau commit dokumen di `prd/`.
- Jangan menambahkan mock listing atau seed sebagai syarat agar Marketplace dapat dibuka.
- Database tanpa row penawaran harus menghasilkan HTTP 200 dengan `items: []` dan menampilkan Empty State.
- Jangan mengubah migration yang sudah diterapkan; gunakan migration timestamp yang sudah tersedia.
- Jangan menampilkan `error.message`, hint PostgREST, URL database, atau key Supabase kepada pengguna.
- Migration remote hanya boleh diterapkan setelah ada persetujuan eksplisit pemilik database.
- Jalankan test terlebih dahulu, lalu implementasi minimal, verifikasi, dan commit kecil.

## Known Evidence

- RPC remote saat ini adalah `search_batches(text,text[],numeric,numeric,numeric,integer,integer)` dan bukan kontrak sembilan parameter.
- Panggilan sembilan parameter menghasilkan `PGRST202`; panggilan tujuh parameter lama menghasilkan HTTP 200 dan `[]`.
- Remote migration history berhenti di `20260831010000`.
- Migration pending adalah `20260831030000_fulfillment_pickup.sql` dan `20260908000000_marketplace_dynamic_read_model.sql`.

## File Map

- Modify: `app/api/marketplace/search/route.ts` — klasifikasi, logging, dan respons aman saat RPC gagal.
- Modify: `tests/unit/api-marketplace-search.test.ts` — regression test untuk `PGRST202` dan kegagalan query generik.
- Existing migration: `supabase/migrations/20260908000000_marketplace_dynamic_read_model.sql` — kontrak RPC dinamis yang harus diterapkan tanpa diedit.
- Modify: `docs/testing/marketplace-dynamic-integration.tdd.md` — bukti RED/GREEN dan smoke test live.

---

### Task 1: Tambahkan regression test untuk schema drift

**Files:**
- Modify: `tests/unit/api-marketplace-search.test.ts`
- Test: `tests/unit/api-marketplace-search.test.ts`

**Interfaces:**
- Consumes: mock Supabase client dengan method `rpc(name, params)`.
- Produces: kontrak error `{ error: string; code: "MARKETPLACE_SCHEMA_OUTDATED" }` dengan status 503 untuk `PGRST202` pada `search_batches`.

- [ ] **Step 1: Perluas helper mock agar dapat mengembalikan RPC error terstruktur**

```ts
interface MockRpcError {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}

function mockSearchClient(options: {
  rows?: SearchRow[];
  rpcError?: MockRpcError | null;
  user?: { id: string; email?: string } | null;
  role?: string;
  profileCoords?: { latitude: number; longitude: number } | null;
}) {
  // Existing auth/from setup remains unchanged.
  const rpc = vi.fn(async () => ({
    data: options.rpcError ? null : (options.rows ?? []),
    error: options.rpcError ?? null,
  }));
  // Return the existing client shape.
}
```

- [ ] **Step 2: Tulis test yang mereproduksi error remote saat ini**

```ts
it("returns a safe 503 when the marketplace RPC schema is outdated", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  mockSearchClient({
    rows: [],
    user: null,
    rpcError: {
      code: "PGRST202",
      message: "Could not find the function public.search_batches",
    },
  });

  const res = await searchBatches(getReq(""));

  expect(res.status).toBe(503);
  await expect(res.json()).resolves.toEqual({
    error: "Marketplace sedang disiapkan. Coba lagi sebentar.",
    code: "MARKETPLACE_SCHEMA_OUTDATED",
  });
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
```

- [ ] **Step 3: Jalankan test dan pastikan RED**

Run:

```powershell
npm test -- tests/unit/api-marketplace-search.test.ts
```

Expected: test baru gagal karena route masih mengembalikan status 500 dan `{ error: "Internal server error" }`.

- [ ] **Step 4: Tambahkan test kegagalan database generik**

```ts
it("keeps unexpected database failures generic", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  mockSearchClient({
    rows: [],
    user: null,
    rpcError: { code: "XX000", message: "database failure" },
  });

  const res = await searchBatches(getReq(""));

  expect(res.status).toBe(500);
  await expect(res.json()).resolves.toEqual({
    error: "Penawaran belum dapat dimuat. Coba lagi.",
    code: "MARKETPLACE_QUERY_FAILED",
  });
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
```

### Task 2: Implementasikan error boundary API yang dapat didiagnosis

**Files:**
- Modify: `app/api/marketplace/search/route.ts`
- Test: `tests/unit/api-marketplace-search.test.ts`

**Interfaces:**
- Consumes: error Supabase dengan properti opsional `code`, `message`, `details`, dan `hint`.
- Produces: status 503 untuk missing RPC dan status 500 untuk kegagalan lain; detail lengkap hanya masuk server log.

- [ ] **Step 1: Tambahkan type guard lokal untuk error RPC yang hilang**

```ts
interface SupabaseRpcError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function isMarketplaceSchemaDrift(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const failure = error as SupabaseRpcError;
  return failure.code === "PGRST202" &&
    /search_batches|get_marketplace_batch/i.test(failure.message ?? "");
}
```

- [ ] **Step 2: Ganti cabang `if (error)` dengan logging dan respons aman**

```ts
if (error) {
  const failure = error as SupabaseRpcError;
  console.error("[marketplace/search] search_batches failed", {
    code: failure.code,
    message: failure.message,
    details: failure.details,
    hint: failure.hint,
  });

  if (isMarketplaceSchemaDrift(error)) {
    return NextResponse.json(
      {
        error: "Marketplace sedang disiapkan. Coba lagi sebentar.",
        code: "MARKETPLACE_SCHEMA_OUTDATED",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      error: "Penawaran belum dapat dimuat. Coba lagi.",
      code: "MARKETPLACE_QUERY_FAILED",
    },
    { status: 500 },
  );
}
```

- [ ] **Step 3: Jalankan test Marketplace dan pastikan GREEN**

Run:

```powershell
npm test -- tests/unit/api-marketplace-search.test.ts tests/unit/marketplace-api-repository.test.ts tests/components/MarketplaceUiStates.test.tsx
```

Expected: seluruh test yang disebutkan lulus.

- [ ] **Step 4: Commit error-boundary API**

```powershell
git add app/api/marketplace/search/route.ts tests/unit/api-marketplace-search.test.ts
git commit -m "fix(marketplace): diagnose stale read model safely"
```

### Task 3: Terapkan migration Marketplace melalui workflow resmi

**Files:**
- Existing: `supabase/migrations/20260831030000_fulfillment_pickup.sql`
- Existing: `supabase/migrations/20260908000000_marketplace_dynamic_read_model.sql`

**Interfaces:**
- Consumes: `DATABASE_URL` dari `.env`; migration history remote sampai `20260831010000`.
- Produces: RPC `search_batches` sembilan parameter dan `get_marketplace_batch(uuid,numeric,numeric)` dengan execute grant untuk `anon` dan `authenticated`.

- [ ] **Step 1: Muat `DATABASE_URL` tanpa mencetak nilainya**

```powershell
$databaseUrlLine = Get-Content -LiteralPath ".env" |
  Where-Object { $_ -match "^DATABASE_URL=" } |
  Select-Object -First 1
$databaseUrl = $databaseUrlLine.Substring($databaseUrlLine.IndexOf("=") + 1).Trim().Trim('"').Trim("'")
```

- [ ] **Step 2: Ulangi dry-run dan verifikasi hanya dua migration yang pending**

```powershell
npx --yes supabase db push --db-url $databaseUrl --dry-run --skip-vault
```

Expected: hanya `20260831030000_fulfillment_pickup.sql` dan `20260908000000_marketplace_dynamic_read_model.sql`; tidak ada seed atau role update.

- [ ] **Step 3: Setelah persetujuan eksplisit, terapkan migration**

```powershell
npx --yes supabase db push --db-url $databaseUrl --skip-vault --yes
```

Expected: kedua migration selesai tanpa rollback atau perubahan data listing.

- [ ] **Step 4: Verifikasi migration history remote**

```powershell
npx --yes supabase migration list --db-url $databaseUrl
```

Expected: kolom Local dan Remote sama sampai `20260908000000`.

### Task 4: Verifikasi endpoint dan Empty State pada database tanpa data

**Files:**
- Modify: `docs/testing/marketplace-dynamic-integration.tdd.md`
- Test: `tests/e2e/umkm-flow.spec.ts`

**Interfaces:**
- Consumes: dev server di `http://localhost:3000` dan schema remote yang sudah sinkron.
- Produces: bukti HTTP 200, payload kosong yang valid, dan UI Empty State tanpa error merah.

- [ ] **Step 1: Jalankan development server dari worktree `marketplace`**

```powershell
npm run dev
```

Expected: Next.js menampilkan `Ready` dan mendeteksi `.env`.

- [ ] **Step 2: Panggil endpoint listing tanpa memutasi data**

```powershell
$response = Invoke-WebRequest "http://localhost:3000/api/marketplace/search?q=&radius=10&page=1&limit=12"
$response.StatusCode
$response.Content
```

Expected pada database tanpa batch: status `200`, `items` bernilai `[]`, `total` bernilai `0`, dan `origin.source` bernilai `bandung_default`.

- [ ] **Step 3: Buka UI Marketplace dan verifikasi Empty State**

Open: `http://localhost:3000/marketplace`

Expected: skeleton muncul saat request berjalan, lalu Empty State tampil; teks `Internal server error` dan panel error merah tidak muncul.

- [ ] **Step 4: Jalankan test migration dan E2E terarah**

```powershell
npm test -- tests/migrations/marketplace-read-model.test.ts
npx playwright test tests/e2e/umkm-flow.spec.ts --grep "Marketplace"
```

Expected: kedua command lulus.

- [ ] **Step 5: Catat bukti live dan commit dokumentasi**

Tambahkan status migration, response endpoint, dan hasil UI ke `docs/testing/marketplace-dynamic-integration.tdd.md`, tanpa menyalin URL database atau key.

```powershell
git add docs/testing/marketplace-dynamic-integration.tdd.md
git commit -m "docs(marketplace): record API recovery evidence"
```

### Task 5: Jalankan final gate dan publish branch

**Files:**
- Verify only: seluruh file yang berubah sejak `origin/marketplace`.

**Interfaces:**
- Consumes: seluruh perubahan dan migration remote yang telah diverifikasi.
- Produces: branch `marketplace` hijau dan siap di-pull.

- [ ] **Step 1: Jalankan unit dan component test lengkap**

```powershell
npm test
```

Expected: tidak ada test gagal.

- [ ] **Step 2: Jalankan lint dan build**

```powershell
npm run lint
npm run build
```

Expected: 0 error; warning lama dicatat terpisah dan build selesai.

- [ ] **Step 3: Review diff agar tidak ada `.env`, secret, atau perubahan PRD**

```powershell
git status --short
git diff --check
git diff --stat origin/marketplace...HEAD
```

Expected: hanya source, test, dan dokumentasi yang direncanakan.

- [ ] **Step 4: Push branch**

```powershell
git push origin marketplace
```

Expected: `origin/marketplace` menunjuk commit recovery terbaru.

## Execution status — 2026-09-08

Implemented locally: Tasks 1–2 (RPC error classification and safe response) plus the targeted unit tests. The remote migration task is intentionally pending explicit database-owner approval because it writes schema to Supabase. Task 4 UI behavior already consumes the API error message through `lib/marketplace/api-repository.ts`; the existing skeleton and Empty State remain unchanged.

Evidence is recorded in `docs/testing/marketplace-supplier-recovery.tdd.md` and `docs/testing/supplier-registration-recovery.tdd.md`.