# TDD Evidence Report — Admin Audit Write Path & Admin Action RPCs

**Task:** Close the audit gap in the Wesup moderation stack — `admin_audit_logs` was append-only but nothing ever wrote to it, its INSERT policy let any authenticated user forge rows, and TRUNCATE was unguarded. Deliver: hardened audit table, a server-side write path, and a backend-only admin action API (9 POST routes + 1 GET audit-logs route), no UI changes.

**Source plan:** No `*.plan.md` file was persisted — the plan was produced in-session (requirements grilling + plan review, approved by the user). Requirements trace to `prd/PRD.md` module 8 (Moderation), §3.6 API Gatekeeper, §3.7 Hit-and-Run escalation.

## User journeys

1. As an Admin, I want to approve/reject a supplier's KYC application, so that only verified suppliers go live, with every decision recorded. (`approve_supplier` / `reject_supplier`)
2. As an Admin, I want to take down a published batch with a reason, so that policy-violating offers are removed and affected UMKM are refunded. (`takedown_batch`)
3. As an Admin, I want to resolve a dispute in favor of supplier or UMKM, so that escrow is released or routed to the refund queue. (`resolve_dispute`)
4. As an Admin, I want to approve and complete manual refunds with transfer proof, so that money is only returned with an audit trail. (`approve_refund` / `complete_refund`)
5. As an Admin, I want to suspend, ban, and unban users, so that the Hit-and-Run escalation ladder is enforceable. (`suspend_user` / `ban_user` / `unban_user`)
6. As an Admin, I want to list the audit log, so that every admin action is verifiable. (`GET /api/admin/audit-logs`)
7. As a non-admin user, I want my attempts to forge or truncate audit rows to be rejected, so that the log stays trustworthy. (RLS/trigger/RPC guards)

## Task report

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| Unit tests for admin routes (RED) | Wrote `tests/unit/api-admin.test.ts` — 28 tests covering auth guards (401/403), UUID/body validation (400), RPC argument shapes incl. ip/user-agent, GET pagination/filters. | `npx vitest run tests/unit/api-admin.test.ts` | **RED→GREEN** — routes did not exist (module load failed), then 28/28 after `app/api/admin/*` routes were written |
| Migration contract tests (RED) | Extended `tests/helpers/schema-contract.ts` (REQUIRED_FUNCTIONS +9, REQUIRED_TRIGGERS +`admin_audit_logs_no_truncate`) and `tests/migrations/schema.test.ts` (TRUNCATE guard, SELECT-only client surface, write_audit_log def + revoke). | `npm test` | **RED** — 3 failed (missing SQL), then **GREEN** |
| Live integration tests (RED) | Added `tests/live/database.integration.test.ts` (TRUNCATE blocked, non-admin `write_audit_log` rejected, approve_supplier RPC audit write path) and `tests/live/auth-rls.integration.test.ts` (non-admin REST INSERT blocked). | `npx vitest run tests/live/` | **RED** — 13 failed (functions/trigger absent from live DB), then **GREEN** |
| Migration `20260814000000_admin_audit_rpc.sql` | Drop forgeable INSERT policy; TRUNCATE guard trigger + revoke; `write_audit_log` security-definer writer; 9 admin action RPCs; grants (action RPCs → `authenticated`, writer → no client roles). | applied to live Supabase in a transaction + tracked in `supabase_migrations.schema_migrations` | PASS |
| Admin routes | 9 POST routes (`suppliers/[id]/approve|reject`, `batches/[id]/takedown`, `disputes/[id]/resolve`, `refunds/[id]/approve|complete`, `users/[id]/suspend|ban|unban`) + `audit-logs/route.ts` GET; shared `lib/admin/validation.ts` helpers. | `npm test` | PASS |
| Type surface | `types/database.ts` Functions section +10 RPC signatures; added `Relationships: []` to all 21 tables (the generated-style surface was missing it, which made `Schema` resolve to `never` and silently disabled typed `rpc()` args — surfaced by the first typed RPC calls; verified no pre-existing call sites broke). | `npx tsc --noEmit` | PASS |
| Lint + build | `npm run lint`, `npm run build` | — | PASS |

## Test specification

| # | What is guaranteed | Test file | Test type | Result |
|---|--------------------|-----------|-----------|--------|
| 1 | Every admin route returns 401 unauthenticated / 403 non-admin | `tests/unit/api-admin.test.ts` | unit | PASS |
| 2 | Non-UUID ids → 400; malformed/empty bodies → 400 | `tests/unit/api-admin.test.ts` | unit | PASS |
| 3 | RPC calls receive `p_`-prefixed args + ip/user-agent from request headers | `tests/unit/api-admin.test.ts` | unit | PASS |
| 4 | GET audit-logs enforces limit 1–100, offset ≥ 0, invalid → 400 | `tests/unit/api-admin.test.ts` | unit | PASS |
| 5 | GET audit-logs filters by action_type (enum member) and admin_id (uuid), orders created_at desc, paginates via `.range()` | `tests/unit/api-admin.test.ts` | unit | PASS |
| 6 | Migration follows `YYYYMMDDHHMMSS_name.sql` naming, parses as valid PostgreSQL | `tests/migrations/schema.test.ts` | unit | PASS |
| 7 | `admin_audit_logs` client surface is read-only (SELECT-only policies; INSERT policy dropped) | `tests/migrations/schema.test.ts` | unit | PASS |
| 8 | TRUNCATE is blocked by trigger `admin_audit_logs_no_truncate` + revoked from client roles | `tests/migrations/schema.test.ts` | unit | PASS |
| 9 | `write_audit_log` exists, is security definer, EXECUTE revoked from public/anon/authenticated | `tests/migrations/schema.test.ts` | unit | PASS |
| 10 | All 10 RPCs + trigger exist in the live DB (REQUIRED_FUNCTIONS/REQUIRED_TRIGGERS) | `tests/live/database.integration.test.ts` | live | PASS |
| 11 | TRUNCATE on `admin_audit_logs` raises P0001 in the live DB | `tests/live/database.integration.test.ts` | live | PASS |
| 12 | `write_audit_log` from a non-admin session raises P0001 | `tests/live/database.integration.test.ts` | live | PASS |
| 13 | `approve_supplier` transitions supplier + appends audit row atomically (set_config JWT claims, rolled back) | `tests/live/database.integration.test.ts` | live | PASS |
| 14 | REST INSERT into `admin_audit_logs` by non-admin is rejected (RLS) | `tests/live/auth-rls.integration.test.ts` | live | PASS |

**Command:** `npm test` → `Test Files 14 passed, 1 skipped (15)`, `Tests 539 passed (539)`.

## Coverage and known gaps

- **Coverage:** `npm run test:coverage` is configured for `lib/**` + `tests/helpers/**`; the audit helper `lib/admin/validation.ts` is covered by the 28 unit tests (direct import, no mocks needed for the pure helpers).
- **Live DB:** migration 0009 was applied to the live Supabase project in a single transaction and tracked in `supabase_migrations.schema_migrations` (version `20260814000000`). Post-run residue check: 0 rows in `admin_audit_logs`, 0 test users — no orphaned test data.
- **Transient 555 flake hardened:** a few full-suite runs flaked on the REST smoke test with an undocumented status `555` from the Supabase edge (not a documented PostgREST code; its connection errors are 503/504) on many tables at once under parallel load. It never reproduced in isolation or with targeted load scripts. The test was hardened with defense-in-depth: 15s per-request timeout, retry on transient 5xx (up to 3 attempts), bounded concurrency (chunks of 5 tables), and the response body is now included in failure output for future diagnosis.
- **Build blocking issue found by `npm run build`:** the first typed `.rpc()` calls exposed that `types/database.ts` tables lacked `Relationships`, so Supabase's `GenericSchema` check failed and `Schema` resolved to `never` (loose typing). Fixed by adding `Relationships: []` to all 21 tables — `npm run build` and `npx tsc --noEmit` now pass, and typed RPC args are enforced.
- **Atomicity:** each action RPC writes state + audit row in one transaction, so an action can never be recorded without its state change (and vice versa — the audit row cannot be skipped).
- **Absolute timestamps (PRD §3.6):** state timestamps (`verified_at`, `decided_at`, `takedown_at`, …) are set server-side with `now()` so audit records cannot be backdated by the client; the one client-supplied absolute timestamp is `suspended_until`, validated by `isIsoTimestamp()` in the route and a future-check inside the function.
- **Known gap — other state transitions:** only the 9 admin actions write audit rows; supplier-initiated and UMKM-initiated transitions (batch publish, pickup, ratings, …) are not yet audited. Out of scope for this task (admin moderation focus) and can be layered on `write_audit_log` later.
- **Known gap — service role:** the write path uses security-definer RPCs rather than a `SUPABASE_SERVICE_ROLE_KEY` client; this removes key distribution from the app tier. `SUPABASE_SERVICE_ROLE_KEY` remains absent from `.env` (intentional).

## Merge evidence (in case of squash)

- **RED:** `test: admin audit write path — routes, migration contract, live guards` — live suite 13 failed (functions/trigger not yet in live DB: `42883` undefined_function, `function X missing`, `trigger … missing`).
- **GREEN:** `feat: admin audit write path, action RPCs, and admin API routes` — full suite 539/539 passed; live residue check clean.
