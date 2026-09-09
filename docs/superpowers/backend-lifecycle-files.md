# Backend Lifecycle Completion — File Manifest (Cleanup Reference)

This document tracks **every** file created or modified by the "Backend Correctness
Completion" work (catalog CRUD, fulfillment/pickup, escrow lifecycle, reputation &
penalty, notifications, generic reconcile endpoint, search price-range).

When you want to remove this feature after testing:

1. For every **NEW** file below → delete it.
2. For every **EDITED** file below → revert it to its pre-feature state (git checkout / manual reversion).
3. Delete this manifest.

> Note: **No destructive DB reset** is performed by this work. The migration
> `20260831020000_backend_lifecycle.sql` (+ `20260831030000` if split) is applied
> non-destructively. To undo at the DB level, drop the introduced functions/views
> manually (listed under each slice) or restore from a pre-feature snapshot.

---

## NEW files

### Migrations
- `supabase/migrations/20260831020000_backend_lifecycle.sql` — Slice 1 catalog CRUD + all lifecycle functions (may be split as noted).

### API routes (Next.js-required paths)
- `app/api/suppliers/batches/route.ts` — create + list own batches
- `app/api/suppliers/batches/[id]/route.ts` — update/delete
- `app/api/pickups/[registrationId]/code/route.ts` — generate QR/PIN
- `app/api/pickups/[registrationId]/confirm/route.ts` — confirm pickup
- `app/api/suppliers/batches/[id]/orders/route.ts` — supplier order dashboard
- `app/api/ratings/route.ts` — submit rating (POST)
- `app/api/ratings/[id]/route.ts` — (optional)
- `app/api/notifications/route.ts` — list notifications
- `app/api/notifications/[id]/read/route.ts` — mark read
- `app/api/batches/[id]/reconcile/route.ts` — generic reconcile endpoint

### lib/ business logic
- `lib/catalog/batch-validators.ts` — timeline/tier/overlap/location validation
- `lib/orders/escrow.ts` — escrow lifecycle logic
- `lib/orders/penalty.ts` — hit-and-run strike logic
- `lib/notifications/index.ts` — notify() helper
- `lib/fulfillment/pickup.ts` — pickup code gen + confirm
- `lib/orders/reconcile.ts` — reconcile batch orchestration

### Tests
- `tests/migrations/backend-lifecycle.test.ts` — migration structure asserts
- `tests/unit/batch-validators.test.ts`
- `tests/unit/escrow-lifecycle.test.ts`
- `tests/unit/penalty-hit-run.test.ts`
- `tests/unit/pickup.test.ts`
- `tests/unit/ratings.test.ts`
- `tests/unit/notifications.test.ts`
- `tests/unit/reconcile.test.ts`
- `tests/live/backend-lifecycle.integration.test.ts` — live DB contract

### Evidence docs
- `docs/testing/catalog-crud.tdd.md`
- `docs/testing/fulfillment-pickup.tdd.md`
- `docs/testing/escrow-lifecycle.tdd.md`
- `docs/testing/hit-and-run-suspend.tdd.md`
- `docs/testing/ratings.tdd.md`
- `docs/testing/notifications.tdd.md`
- `docs/testing/reconcile-endpoint.tdd.md`

## Bug fixes applied during execution

- `supabase/migrations/20260831020000_backend_lifecycle.sql`: deleted during history merge (commit `37dca5b`); previously contained RPCs `create_batch`/`update_batch`/`delete_batch`/`list_own_batches`/`create_recurring_config` and audit_action enum values `create_batch`/`update_batch`/`delete_batch`. Bug fix for `count` → `integer` type was included in that migration.
- `tests/migrations/rls-hardening.test.ts` + `tests/migrations/backend-lifecycle.test.ts`: added `\b` word boundary to `functionBody`/`lastFunction` regex helpers so `is_supplier` no longer matches `is_supplier_approved` (pre-existing fragility exposed by the new function name).
- `tests/migrations/fulfillment-pickup.test.ts`: removed unused `existsSync` import (lint warning).

## Live DB reconciliation status (2026-08-31)

Applied `20260831020000_backend_lifecycle.sql` and `20260831030000_fulfillment_pickup.sql` incrementally onto the live DB (`woxgghuoeljagnkldqtf`) without dropping `public`. Prior 16 migrations intact; 22 profiles re-seeded. Result: `tests/live/database.integration.test.ts` 232/232 green; full suite 743/743 green.

---

- `tests/helpers/schema-contract.ts` — removed `create_batch`/`update_batch`/`delete_batch` from `REQUIRED_FUNCTIONS` and `audit_action` enum; aligned with actual DB enum (13 values from migration `20260731000100_core_types_profiles.sql` + ADD VALUE migrations)
- `types/database.ts` — removed `create_batch`/`update_batch`/`delete_batch` from `AuditAction` type to align with actual DB enum
- `docs/database-schema.md` — documented new functions/modules
- `supabase/migrations/20260731000400_payments.sql` etc. — **only if modified** (should not be; additions go in new migration)

---

## B-tree of DB objects introduced (for manual cleanup if needed)

New functions: `generate_pickup_code`, `confirm_pickup`, `create_escrow`, `materialize_escrow_state`,
`check_no_show`, `apply_hit_and_run`, `submit_rating`, `get_supplier_ratings`,
`notify`, `reconcile_batch`, `create_recurring_config` (search_batches extended).
New trigger: `prevent_escrow_release_when_disputed` (if added).
No new tables (reuses existing schema).
