# Web Worker Image Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyediakan modul kompresi gambar berbasis Web Worker yang menerima unggahan foto maksimal 10 MB, memprosesnya secara asynchronous/non-blocking, dan mengembalikan hasil yang dapat dipakai untuk foto KTP, lokasi Supplier, serta produk.

**Architecture:** Pisahkan kontrak/validasi yang murni dan mudah dites dari runtime Worker yang memakai `createImageBitmap` dan `OffscreenCanvas` sebagai baseline browser yang didukung. Kompresi tetap Worker-only dan non-blocking; tidak ada fallback `HTMLCanvasElement` atau pemrosesan canvas di main thread. Client memanggil satu API `compressImage(file, options?)`; bridge mengelola lifecycle Worker, request ID, error, timeout, dan pembatalan tanpa membuat komponen React bergantung langsung pada protocol Worker.

**Tech Stack:** TypeScript 5, Next.js 16.2 App Router, browser Web Worker API, `createImageBitmap`, Canvas API, Vitest 4. Tidak menambah package eksternal.

## Global Constraints

- Batas ukuran file mentah adalah maksimal 10 MB; file yang lebih besar ditolak sebelum dikirim ke Worker.
- Proses kompresi harus non-blocking terhadap render UI dan hanya dipanggil dari client/browser boundary.
- Gunakan Lazy Evaluation/API Gatekeeper yang sudah ditetapkan project untuk alur backend; modul ini hanya menangani preprocessing di frontend.
- Jangan menyimpan secret atau mengubah `prd/`; dokumentasi TDD disimpan di `docs/testing/*.tdd.md`.
- Ikuti alias `@/*`, strict TypeScript, pola test Vitest yang sudah ada, dan jangan menambahkan state manager baru.
- Jalankan test terarah, seluruh test, lint, dan build sebelum menyatakan selesai.

---

### Task 1: Tetapkan kontrak, opsi, dan validasi input kompresi

**Files:**
- Create: `lib/image-compression/types.ts`
- Create: `lib/image-compression/validation.ts`
- Test: `tests/unit/image-compression-validation.test.ts`

**Interfaces:**
- Produces `CompressionOptions`, `CompressionResult`, `CompressionErrorCode`, `MAX_INPUT_BYTES`, `validateImageInput(file)`, dan `normalizeCompressionOptions(options?)` untuk dipakai Task 2 dan Task 3.

- [ ] **Step 1: Write the failing tests**

  Cover: file tepat 10 MiB diterima; file di atas 10 MiB ditolak dengan kode `INPUT_TOO_LARGE`; MIME non-gambar ditolak dengan kode `UNSUPPORTED_TYPE`; opsi default menghasilkan `maxDimension: 2000`, `quality: 0.82`, dan `outputType: "image/jpeg"`; opsi quality di luar 0..1 dan maxDimension non-positif ditolak.

- [ ] **Step 2: Run the validation test to verify it fails**

  Run: `npm test -- tests/unit/image-compression-validation.test.ts`
  Expected: FAIL karena kontrak dan fungsi validasi belum tersedia.

- [ ] **Step 3: Implement the minimal contract and validation**

  Define `CompressionResult` with `blob`, `originalSize`, `compressedSize`, `width`, `height`, and `mimeType`. Keep validation synchronous and independent from DOM APIs so it remains runnable in Vitest's Node environment.

- [ ] **Step 4: Run the validation test to verify it passes**

  Run: `npm test -- tests/unit/image-compression-validation.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add lib/image-compression/types.ts lib/image-compression/validation.ts tests/unit/image-compression-validation.test.ts` lalu `git commit -m "test: define image compression input contract"`.

### Task 2: Implement Worker protocol dan image compression runtime

**Files:**
- Create: `lib/image-compression/worker-protocol.ts`
- Create: `lib/image-compression/image-compression.worker.ts`
- Test: `tests/unit/image-compression-worker-protocol.test.ts`

**Interfaces:**
- Consumes `CompressionOptions` dan validator dari Task 1.
- Produces request/response protocol bertipe: `CompressionWorkerRequest = { id, file, options }`, `CompressionWorkerSuccess = { id, ok: true, result }`, dan `CompressionWorkerFailure = { id, ok: false, code, message }`.

- [ ] **Step 1: Write the failing protocol tests**

  Test type guards/serializers for success dan failure response, preservation of request ID, conversion of worker error menjadi `WORKER_FAILED`, serta rejection of malformed response tanpa melempar error mentah ke caller.

- [ ] **Step 2: Run the protocol test to verify it fails**

  Run: `npm test -- tests/unit/image-compression-worker-protocol.test.ts`
  Expected: FAIL karena protocol belum tersedia.

- [ ] **Step 3: Implement Worker runtime**

  In the Worker, validate the input again, decode with `createImageBitmap(file)`, calculate a proportional target size capped by `maxDimension`, draw to `OffscreenCanvas` as the supported browser baseline, call `convertToBlob({ type: outputType, quality })`, verify that the returned blob MIME exactly matches `outputType`, and post a typed result. Do not add an `HTMLCanvasElement`/main-thread fallback. Revoke/close disposable bitmap resources and return structured failures for decode, canvas, and encode errors. Keep the Worker module free of React/Next imports.

- [ ] **Step 4: Run the protocol test to verify it passes**

  Run: `npm test -- tests/unit/image-compression-worker-protocol.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add lib/image-compression/worker-protocol.ts lib/image-compression/image-compression.worker.ts tests/unit/image-compression-worker-protocol.test.ts` lalu `git commit -m "feat: add image compression worker protocol"`.

### Task 3: Build the client-side asynchronous bridge

**Files:**
- Create: `lib/image-compression/compress-image.ts`
- Create: `lib/image-compression/index.ts`
- Test: `tests/unit/compress-image.test.ts`

**Interfaces:**
- Produces `compressImage(file: File, options?: CompressionOptions & { signal?: AbortSignal; timeoutMs?: number }): Promise<CompressionResult>`.
- The bridge must reject synchronously-invalid input before Worker creation, resolve by matching request ID, reject Worker failures with a typed error, terminate/clean up the Worker after completion, abort on `AbortSignal`, and time out with `WORKER_TIMEOUT` (default 30 seconds).

- [ ] **Step 1: Write the failing bridge tests**

  Mock the global `Worker` constructor and assert: oversized input does not construct a Worker; a success message resolves the expected result; a failure message rejects with its code; abort rejects with `ABORTED` and calls `terminate`; timeout rejects with `WORKER_TIMEOUT`; multiple concurrent calls do not cross-resolve request IDs.

- [ ] **Step 2: Run the bridge test to verify it fails**

  Run: `npm test -- tests/unit/compress-image.test.ts`
  Expected: FAIL because `compressImage` is not implemented.

- [ ] **Step 3: Implement the bridge**

  Instantiate the bundled Worker using `new Worker(new URL("./image-compression.worker.ts", import.meta.url), { type: "module" })`. Maintain a per-call pending record, post the request with normalized options, and ensure every settle path removes listeners, clears timers, and terminates the Worker. Guard browser-only Worker construction so importing the module during SSR does not access `window`.

- [ ] **Step 4: Run the bridge test to verify it passes**

  Run: `npm test -- tests/unit/compress-image.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  Run: `git add lib/image-compression/compress-image.ts lib/image-compression/index.ts tests/unit/compress-image.test.ts` lalu `git commit -m "feat: expose async image compression API"`.

### Task 4: Verify frontend integration boundary and document usage

**Files:**
- Modify: `lib/image-compression/index.ts`
- Create: `docs/testing/image-compression-worker.tdd.md`
- Test: `tests/unit/image-compression-public-api.test.ts`

**Interfaces:**
- Public barrel exports only the stable client API and types needed by future upload forms; no UI page is changed until actual KTP/location/product upload forms exist.

- [ ] **Step 1: Write the failing public API test**

  Assert that the barrel exports `compressImage`, `MAX_INPUT_BYTES`, `CompressionOptions`, and `CompressionResult`, while importing the barrel in a Node test does not instantiate a Worker or access browser globals.

- [ ] **Step 2: Run the public API test to verify it fails**

  Run: `npm test -- tests/unit/image-compression-public-api.test.ts`
  Expected: FAIL until the barrel export boundary is finalized.

- [ ] **Step 3: Finalize exports and write TDD evidence**

  Keep the public surface minimal. Record the red/green test commands, supported input types, 10 MB rejection behavior, Worker lifecycle behavior, and known browser requirement in `docs/testing/image-compression-worker.tdd.md`.

- [ ] **Step 4: Run focused and full verification**

  Run: `npm test -- tests/unit/image-compression-validation.test.ts tests/unit/image-compression-worker-protocol.test.ts tests/unit/compress-image.test.ts tests/unit/image-compression-public-api.test.ts`
  Expected: PASS.

  Run: `npm test`
  Expected: PASS, including existing auth, migration, and live-test behavior according to configured environment.

  Run: `npm run lint`
  Expected: PASS with no new lint errors.

  Run: `npm run build`
  Expected: PASS and Next.js successfully bundles the Worker URL import; if bundling rejects the Worker entry, stop and adjust the Worker placement/import strategy before integrating upload forms.

- [ ] **Step 5: Commit**

  Run: `git add lib/image-compression/index.ts docs/testing/image-compression-worker.tdd.md tests/unit/image-compression-public-api.test.ts` lalu `git commit -m "docs: document image compression worker verification"`.

## Self-review checklist

- Covers the 10 MB raw upload limit before Worker dispatch.
- Keeps compression off the main UI thread and isolates browser-only APIs.
- Defines a stable API reusable by KTP, Supplier location, and product upload flows.
- Tests validation, protocol, lifecycle, cancellation, timeout, concurrency, SSR-safe import, and build integration.
- Does not add a dependency or modify private PRD files.
