# Image Compression Worker — TDD Evidence

## Scope and public contract

The image-compression module prepares camera uploads for the future KTP, business-location, product, and dispute-evidence forms. No upload form or page is integrated yet.

Import the stable client boundary from `@/lib/image-compression`:

```ts
import {
  compressImage,
  CompressionError,
  MAX_INPUT_BYTES,
  type CompressionErrorCode,
  type CompressionOptions,
  type CompressionResult,
} from "@/lib/image-compression";
```

- `compressImage(file, options)` asynchronously returns a `CompressionResult`.
- `MAX_INPUT_BYTES` is `10 * 1024 * 1024` bytes (10 MiB), allowing forms to reject an oversized selection before starting compression.
- `CompressionOptions` supports `maxDimension`, `quality`, and an `outputType` of `image/jpeg`, `image/png`, or `image/webp`.
- `CompressionError` and `CompressionErrorCode` let client forms present typed failures without depending on Worker protocol internals.

Importing this barrel during SSR or in Node does not read `window` or `Worker` and does not construct a Worker. Calling `compressImage` outside a browser rejects with a typed `WORKER_FAILED` error.

## Input and output behavior

- Input MIME types: values whose declared MIME type starts with `image/`. Actual decode support remains browser-dependent.
- Raw input limit: files at exactly 10 MiB are accepted; files larger than 10 MiB fail with `INPUT_TOO_LARGE` before Worker construction or image decoding.
- Defaults: maximum dimension `2000`, quality `0.82`, and JPEG output. A field explicitly set to `undefined` receives its field default.
- Runtime values outside the supported `image/jpeg`, `image/png`, and `image/webp` output allowlist fail with `INVALID_OPTIONS` before Worker construction.
- `outputType` is an exact requested codec, not a preference. If `OffscreenCanvas.convertToBlob` returns a different MIME type, compression fails with `ENCODE_FAILED` instead of returning a fallback encoding.
- Resizing preserves aspect ratio, never upscales, and keeps each output dimension at least one pixel.
- The result contains the encoded `Blob`, original and compressed byte counts, output dimensions, and MIME type.

## Worker lifecycle and browser requirements

Every `compressImage` call creates its own module Worker with a unique request ID. The bridge accepts only the matching, structurally valid response. Success, Worker-declared failure, malformed or unreadable messages, runtime errors, abort, timeout, and synchronous `postMessage` failure all converge on one idempotent cleanup path that removes listeners, clears the timer, removes the abort listener, and terminates the Worker. The default timeout is 30 seconds. The implementation creates no object URLs.

The supported browser baseline requires module Worker support, `createImageBitmap`, `OffscreenCanvas`, a 2D canvas context, and `OffscreenCanvas.convertToBlob` support for the exact requested output codec. Compression remains Worker-only and non-blocking; there is deliberately no `HTMLCanvasElement` or main-thread canvas fallback. Missing decode, canvas, or encode capabilities surface as typed `DECODE_FAILED`, `CANVAS_FAILED`, or `ENCODE_FAILED` errors. The installed Next.js 16.2 Turbopack guide documents support for `new Worker()` dynamic expressions; the production build is the integration check for the concrete `new Worker(new URL("./image-compression.worker.ts", import.meta.url), { type: "module" })` entry.

## RED/GREEN history

### Task 1 — contract and validation

- RED: `npm test -- tests/unit/image-compression-validation.test.ts` failed because `@/lib/image-compression/validation` did not exist.
- GREEN: the same command passed 8 tests after the initial contract and validation implementation.
- Validation fix RED: 3 new cases failed because `quality: NaN`, `maxDimension: NaN`, and `maxDimension: Infinity` were accepted.
- Validation fix GREEN: the focused file passed 11 tests after finite-number guards were added.

### Task 2 — Worker protocol and runtime

- RED: `npm test -- tests/unit/image-compression-worker-protocol.test.ts` failed because the Worker protocol module did not exist.
- GREEN: the initial protocol/runtime suite passed 8 tests.
- Hardening RED: 15 tests ran, with 5 expected failures showing acceptance of a forged File-like object, missing bitmap cleanup for invalid dimensions, and a missing installed-listener boundary handler; 10 tests passed.
- Hardening GREEN: the focused suite passed all 15 tests after the guards, cleanup ownership, and boundary handler were corrected.

### Task 3 — asynchronous client bridge

- RED: `npm test -- tests/unit/compress-image.test.ts` failed because the public compression bridge did not exist.
- GREEN: the final initial bridge suite passed 14 tests, including the synchronous `postMessage` cleanup regression.
- Timeout-validation RED: 4 new cases failed (14 passed) because zero, negative, `NaN`, and infinite timeouts reached Worker/timer construction and produced `WORKER_TIMEOUT` instead of `INVALID_OPTIONS`.
- Timeout-validation GREEN: the focused suite passed all 18 tests after finite-positive timeout validation was moved before Worker construction.

### Task 4 — public integration boundary

- RED: `npm test -- tests/unit/image-compression-public-api.test.ts` ran 2 tests; the SSR-safe import case passed, while the public export case failed because `MAX_INPUT_BYTES` was `undefined` instead of `10485760`.
- GREEN: after re-exporting the existing validation constant from the barrel, the same command passed 2 tests.

### Final review fix wave

- RED: `npm test -- tests/unit/image-compression-validation.test.ts tests/unit/compress-image.test.ts tests/unit/image-compression-worker-protocol.test.ts` ran 53 tests: 5 failed and 48 passed. The intended failures proved explicit-`undefined` fields did not default, unsupported runtime MIME reached Worker construction, and browser MIME fallback was returned as success.
- GREEN: the same command passed all 53 tests after field-by-field defaults, runtime MIME allowlist validation, and exact post-encode MIME enforcement were implemented.
- Deferred-minor regressions for no-upscale behavior, portrait proportional resize, Worker-constructor failure, and a valid custom timeout passed in both runs and remain part of the focused suites.

All Vitest runs emit the repository's existing Vite native-config warning for ESM syntax in the CommonJS-loaded `vitest.config.ts`; it does not alter the test results and is unrelated to image compression.

## Final verification (2026-08-10)

### Focused image-compression tests

Command: `npm test -- tests/unit/image-compression-validation.test.ts tests/unit/image-compression-worker-protocol.test.ts tests/unit/compress-image.test.ts tests/unit/image-compression-public-api.test.ts`

Result: PASS - 4 test files passed and all 55 tests passed.

### Full Vitest suite

Command: `npm test`

Result: PASS - 12 test files passed, 1 live-test file was skipped by its configured environment guard, and all 482 executed tests passed.

Both final Vitest runs emitted the existing Vite native-config warning for ESM syntax in CommonJS-loaded `vitest.config.ts`; it did not affect results.

### TypeScript

Command: `npx tsc --noEmit --pretty false`

Result: PASS - exit code 0 with no diagnostics.

### Targeted ESLint

Command: `npx eslint lib/image-compression tests/unit/image-compression-validation.test.ts tests/unit/image-compression-worker-protocol.test.ts tests/unit/compress-image.test.ts tests/unit/image-compression-public-api.test.ts`

Result: PASS - exit code 0 with no findings.

### Repository lint and baseline disposition

Command: `npm run lint`

Result: baseline FAIL - exit code 1 with 14 unrelated findings: 1 error and 13 warnings.

The sole error remains the declared pre-existing baseline finding:

```text
.opencode/tools/run-tests.ts:44:9
'cmd' is never reassigned. Use 'const' instead  prefer-const
```

The 13 warnings are unrelated unused-variable findings in `.agents/skills/ck/commands/shared.mjs` and `.opencode` plugin/tool files. No `lib/image-compression` or focused image-compression test file appears in repository-lint output. Per scope, `.agents` and `.opencode` were not modified.

### Next.js production build

Command: `npm run build`

Result: PASS - Next.js 16.2.10/Turbopack compiled successfully in 23.0 seconds, completed TypeScript in 3.6 seconds, generated all 4 static pages, and exited 0.

The build emitted the existing multiple-lockfile workspace-root warning and selected `D:\Project\wesup\package-lock.json`; the warning did not affect compilation. No build-generated artifact is committed.
