# TDD Evidence Report — Auth & RLS Hardening

**Task:** Harden authentication and row-level security for the Wesup group-buying platform: email/password Supabase Auth via API route handlers, RLS role separation (admin/supplier/umkm), and account status (ban/suspend) enforcement. No UI.

**Source plan:** `docs/superpowers/plans/2026-08-05-auth-rls-hardening.md` (approved plan, Tasks 0–6). Journeys below are extracted from that plan.

## User journeys

1. As a visitor, I want to sign up with email/password, so that I always start as an UMKM — never as a supplier or admin. (`handle_new_user` forces role `'umkm'`; column grants make role escalation impossible.)
2. As an UMKM, I want to update my own profile (name, phone), so that my account data stays current — while role/status columns are locked by column grants.
3. As an UMKM, I want to submit my KYC data as a supplier application, so that Admin can verify me — without being able to approve my own application or set my own verification status.
4. As an Admin, I want to approve a supplier KYC application, so that the applicant is promoted to supplier in the same operation (`approve_supplier` RPC + `promote_supplier_on_approval` trigger).
5. As an Admin, I want to ban or suspend a user, so that the account immediately loses all privileged access (`is_admin`/`is_supplier` require `status='active'`).
6. As an authenticated user, I want my session refreshed on every request, so that I stay signed in without re-authentication (`proxy.ts`).
7. As a registered user, I want to recover my password, so that I can reset it with a valid code even after forgetting it (forgot-password → reset-password flow).
8. As a signed-in user, I want to log out, so that my session is fully terminated (`logout` route).

## Task report

| Task | Execution summary | Validation command | Result |
|------|-------------------|--------------------|--------|
| 1 — Migration 0010 (RLS hardening) | Static contract tests + migration `20260805000000_auth_rls_hardening.sql` (role-forced signup, column grants, `approve_supplier` RPC, active-status role helpers, supplier-promotion trigger). Applied to remote via `supabase db push`. | `npm test` | **RED** (379bef4, 5 new static assertions on missing SQL) → **GREEN** 363/363 (5445a71 + fixes c1e2ccb, f048041) |
| 2 — Server client + session proxy | `lib/supabase/server.ts` (cookie-based `getServerClient`) + `proxy.ts` session refresh. | `npm test tests/unit/server.test.ts`; `npm run build` | **RED** (6ef5b32, factory tests) → **GREEN** 367/367 (6723a13, 2360226; proxy fix 9f5689c), build passes with `ƒ Proxy (Middleware)` |
| 3 — Auth helpers | `lib/supabase/auth.ts`: `AuthError`, `getCurrentUser`, `requireRole`, `requireActive`, `toAuthResponse` — DI-friendly against a hand-rolled fake client. | `npm test tests/unit/auth.test.ts` | **RED** (c1646d2, 21 access-rule tests) → **GREEN** 386/386 (52d1919 + DI fixes d58af7c, 87a3b7d) |
| 4 — Auth API routes | 6 route handlers under `app/api/auth/*` (signup, login, logout, forgot-password, reset-password, session). | `npm test tests/unit/api-auth.test.ts` | **RED** (32c9d97, 30 route-contract tests) → **GREEN** 418/418 (0c46549 + fixes 0b24f1c, b020f8d) |
| 5 — Admin seed script | `scripts/seed-admin.mjs` (idempotent role promotion, `--remove` revert). Glue script, no unit tests. | `node --check scripts/seed-admin.mjs` | PASS (dd97258; reviewed in combined review) |
| 6 — Env + verification + evidence | `NEXT_PUBLIC_SITE_URL` added to `.env.example`; full suite, coverage, lint, build verified; coverage gap in `server.ts` closed with 4 unit tests; this report. | `npm test` / `npm run test:coverage` / `npm run lint` / `npm run build` | PASS — 422/422 tests; 100% coverage on `lib/**/*.ts`; 0 new lint problems; build OK with `ƒ Proxy (Middleware)` |

### RED/GREEN checkpoint evidence

| Task | RED commit | RED failing tests | GREEN commit | Final count |
|------|-----------|-------------------|--------------|-------------|
| 1 | `379bef4` `test: assert rls hardening requirements in schema contract` | `tests/migrations/rls-hardening.test.ts`: forces every new signup to the umkm role; restricts profile updates to safe columns only; restricts supplier_profiles writes to safe columns only; gates supplier approval behind an active-admin rpc; gates admin and supplier privileges on active status | `5445a71` `feat: harden auth rls role separation and supplier promotion` (+ `c1e2ccb`, `f048041`) | 363/363 |
| 2 | `6ef5b32` `test: server client factory` | `tests/unit/server.test.ts`: getServerClient throws on missing env vars; creates a cookie-based client when both env vars are present | `6723a13` `feat: add cookie-based server client` + `2360226` `feat: add session refresh proxy` (+ `9f5689c` export fix) | 367/367 |
| 3 | `c1646d2` `test: auth helper access rules` | `tests/unit/auth.test.ts` (21 tests): null-context cases, 401/403 on `requireRole`/`requireActive`, status-in-message, `toAuthResponse` 401/403/500 mapping | `52d1919` `feat: add role and status auth helpers` (+ `d58af7c`, `87a3b7d` DI fixes) | 386/386 |
| 4 | `32c9d97` `test: auth api route contracts` | `tests/unit/api-auth.test.ts` (30 tests): per-route validation failures, success shapes, error mapping (login 401, signup 409, session 401/403/200, reset-password sign-out-on-failure) | `0c46549` `feat: add auth api route handlers` (+ `0b24f1c`, `b020f8d`) | 418/418 |
| 5 | — (no tests; glue script) | — | `dd97258` `feat: add admin seed script` | `node --check` PASS |

All RED/GREEN checkpoint commits are on `main` and reachable from `HEAD`.

## Test specification

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 1 | New signups are forced to role `'umkm'`; `handle_new_user` never trusts `raw_user_meta_data ->> 'role'` | `tests/migrations/rls-hardening.test.ts` | unit (static SQL assertions) | PASS |
| 2 | Profile writes are restricted to `(full_name, phone, updated_at)`; role/status columns are not writable by authenticated users | `tests/migrations/rls-hardening.test.ts` | unit | PASS |
| 3 | Supplier KYC writes are restricted to safe columns; `verification_status`/`verified_by` are not writable by authenticated users | `tests/migrations/rls-hardening.test.ts` | unit | PASS |
| 4 | `approve_supplier` requires an active admin and sets `verification_status='approved'` | `tests/migrations/rls-hardening.test.ts` | unit | PASS |
| 5 | `is_admin`/`is_supplier` require `status='active'` (ban/suspend cuts privileges) | `tests/migrations/rls-hardening.test.ts` | unit | PASS |
| 6 | `getServerClient` throws unless both Supabase env vars are present; otherwise returns a cookie-wired client | `tests/unit/server.test.ts` | unit | PASS |
| 7 | The server client bridges `next/headers` cookies: `getAll` reads through, `setAll` writes each refreshed cookie, and write failures are swallowed (read-only request scope) | `tests/unit/server.test.ts` | unit | PASS |
| 8 | `getCurrentUser` returns null on no session / `getUser` failure / profile lookup failure; returns context (id, email, role, status, fullName) otherwise | `tests/unit/auth.test.ts` | unit | PASS |
| 9 | `requireRole` throws 401 without session, 403 on disallowed role or non-active status | `tests/unit/auth.test.ts` | unit | PASS |
| 10 | `requireActive` throws 401 without session, 403 with the status in the message when not active | `tests/unit/auth.test.ts` | unit | PASS |
| 11 | `toAuthResponse` maps `AuthError` to `{error}` JSON with 401/403, unknown errors to 500 | `tests/unit/auth.test.ts` | unit | PASS |
| 12 | `POST /api/auth/signup` → 201 `{user}`; 400 on invalid email / short password / missing full_name / malformed JSON; 409 on `user_already_exists`; 500 otherwise | `tests/unit/api-auth.test.ts` | unit | PASS |
| 13 | `POST /api/auth/login` → 200 `{user}`; 401 on invalid credentials; 400 on malformed JSON | `tests/unit/api-auth.test.ts` | unit | PASS |
| 14 | `POST /api/auth/logout` → 200 `{ok:true}` even when `signOut` fails | `tests/unit/api-auth.test.ts` | unit | PASS |
| 15 | `POST /api/auth/forgot-password` → 200 always (no user enumeration), redirect targets `NEXT_PUBLIC_SITE_URL` (fallback `http://localhost:3000`) | `tests/unit/api-auth.test.ts` | unit | PASS |
| 16 | `POST /api/auth/reset-password` → 200 after code exchange + password update; 400 on invalid/expired code or short password; signs out before 400 when the update fails (no half-signed-in state) | `tests/unit/api-auth.test.ts` | unit | PASS |
| 17 | `GET /api/auth/session` → 200 with user email + profile role/status/full_name; 401 unauthenticated; 403 with status as `reason` when not active | `tests/unit/api-auth.test.ts` | unit | PASS |
| 18 | Live RLS behavior against the remote project (env-gated): role escalation blocked, own-row updates allowed, KYC self-approval blocked, non-admin RPC rejected, banned user sees only own row | `tests/live/auth-rls.integration.test.ts` | integration (env-gated) | PASS — 9/9 on 2026-08-05 (see Live verification) |

## Coverage

Command: `npm run test:coverage` (vitest v8 provider; include `lib/**/*.ts`, `tests/helpers/**/*.ts`; no thresholds configured in `vitest.config.ts` — requirement enforced per this plan: ≥80% on `lib/**/*.ts`).

| File | % Stmts | % Branch | % Funcs | % Lines |
|------|---------|----------|---------|---------|
| `lib/supabase/auth.ts` | 100 | 100 | 100 | 100 |
| `lib/supabase/client.ts` | 100 | 100 | 100 | 100 |
| `lib/supabase/server.ts` | 100 | 100 | 100 | 100 |
| `tests/helpers/schema-contract.ts` | 100 | 100 | 100 | 100 |
| **All files** | **100** | **100** | **100** | **100** |

First run flagged `server.ts` at 63.63% lines (uncovered: the `setAll` cookie-write path, lines 24–29) — this was the RED trigger. Four unit tests were added to `tests/unit/server.test.ts` (cookie read pass-through, `setAll` write wiring, write-failure swallow, and the genuinely-unset env var path) and the suite went from 418 → 422 tests with 100% coverage on all instrumented files.

## Live verification (2026-08-05)

To exercise the previously env-skipped authenticated RLS assertions end-to-end, email auto-confirm was temporarily enabled on the remote project (`PATCH /v1/projects/woxgghuoeljagnkldqtf/config/auth` → `mailer_autoconfirm: true`), the suite was run, and the setting was restored to `false` immediately after.

`npm test tests/live/auth-rls.integration.test.ts` → **9/9 passed** (431/431 with the full suite):

- blocks role escalation via REST PATCH (`{"role":"admin"}` → ≥400, column grant)
- allows own `full_name` update and persists it (own-row policy)
- blocks self-approval via REST POST with `verification_status` (column insert grant)
- blocks `verification_status` PATCH on own row (column update grant)
- allows legitimate KYC editing (`business_name` PATCH)
- rejects non-admin `approve_supplier` RPC call
- promotes a fresh user via pool insert of an approved supplier profile (trigger on INSERT)
- shows only own row once banned (`is_admin` requires `status='active'`)
- cleans up created test users

Restored `mailer_autoconfirm` to `false` afterwards — the authenticated block env-skips again until a session-capable setup is permanent.

## Known gaps

- **Live authenticated RLS assertions are env-gated again.** They were verified 9/9 on 2026-08-05 by temporarily enabling email auto-confirm on the remote project (see Live verification) and restoring it afterwards; with `mailer_autoconfirm=false` restored, `signUp` returns no session and the authenticated block in `tests/live/auth-rls.integration.test.ts` env-skips (its hooks, including `afterAll` cleanup, are skipped with it). Run it on a session-capable project (auto-confirm enabled) for continuous regression coverage.
- **`proxy.ts` has no unit test.** It is validated by `npm run build` (compiled, exported as `ƒ Proxy (Middleware)` with the expected matcher config) and manual smoke; session-refresh behavior against a live cookie flow is untested.
- **Static grant/revoke regexes do not pin the grantee** — the static contract tests assert the grant statements' presence and column lists, not that they target only `authenticated`.
- **`approve_supplier` is a silent no-op on a missing `user_id`** — no row matched means no error, just zero updates; callers cannot distinguish "not found" from "updated".
- **`anon` retains default table grants** — the migration revokes from `authenticated` only; anon's grants are inert because RLS policies deny anon access, but they remain visible in the grant tables.
- **`seed-admin.mjs` does not lowercase the email argument** — Supabase stores emails lowercased; a mixed-case lookup could miss (recorded NIT).
- **Lint: 14 pre-existing problems in `.opencode/tools`** (1 `prefer-const` error in `run-tests.ts`, 13 `no-unused-vars` warnings across `.opencode/tools`, `.opencode/plugins/ecc-hooks.ts`, `.agents/skills/ck/commands/shared.mjs`). Present before this work and untouched. `npx eslint lib app proxy.ts tests scripts` → 0 problems.

## Merge evidence (in case of squash)

- **RED:** `379bef4` (Task 1 static contract), `6ef5b32` (Task 2 factory), `c1646d2` (Task 3 helpers), `32c9d97` (Task 4 routes), plus Task 6 coverage RED (server.ts 63.63% lines on first `test:coverage` run).
- **GREEN:** `5445a71`, `6723a13`/`2360226`, `52d1919`, `0c46549`, `dd97258` — suite grew 363 → 367 → 386 → 418 → 422 (this task) with every stage all-green; final `npm test` 422/422; final coverage 100% on all instrumented files; `npm run build` succeeds with `ƒ Proxy (Middleware)`.
