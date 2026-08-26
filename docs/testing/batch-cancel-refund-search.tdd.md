# TDD Evidence Report: Batch Cancellation, Auto-Refund Queue & Marketplace Search

Date: 2026-08-22
Scope: Catalog deletion (soft-cancel), automatic Full Refund Queue population, lightweight search API. Backend only.

## Decisions locked in grilling session

| Fork | Decision |
|---|---|
| Delete semantics | Soft-cancel (`status → 'cancelled'`), never hard DELETE |
| Cancel window | Until first pickup scan; blocked once any registration is `picked_up`/`completed` |
| Refund eligibility | `paid` → refund queue; `registered`/`pending_payment` → auto-`cancelled`; `picked_up`/`completed` untouched |
| Automation point | DB trigger on `batches.status` flip (covers supplier cancel AND admin takedown) |
| Notifications | Yes — per affected UMKM; refund ticket starts `pending` |
| Trigger type | New enum value `supplier_cancel` (admin panel clarity) |
| Categories | Strict 5-value allow-list shared with UI mock |
| Geo engine | SQL RPC: bbox prefilter + haversine, no PostGIS |
| Location source | Query params → profile coords → Bandung center |
| Scope | Backend only + `GET /api/admin/refunds` for queue visibility |

## TDD sequence (red → green)

1. **Red**: extended `tests/helpers/schema-contract.ts` (enums, index, functions,
   trigger) and added three unit suites
   (`api-supplier-cancel`, `api-marketplace-search`, `api-admin-refunds`).
   Result: 7 failing tests / missing modules.
2. **Green**: implemented migration `20260822000000_batch_cancel_refund_search.sql`,
   `lib/catalog/categories.ts`, and the three routes.
3. **Live behavior tests** added in
   `tests/live/cancellation-search.integration.test.ts` (12 cases): guard rails
   (no session, empty reason, picked-up block, foreign batch), refund fan-out +
   escrow rerouting + notifications, audit row, takedown parity, unique-ticket
   idempotency, text/category/radius/pagination search semantics.

## Verification

```
npm test        → 21 files, 616 tests passed (unit + migration contract + live)
npm run lint    → 0 errors (1 pre-existing warning in app/page.tsx)
npm run build   → success; routes registered:
                  /api/marketplace/search, /api/suppliers/batches/[id]/cancel,
                  /api/admin/refunds
```

## Live DB reconciliation performed during the session

The shared dev database contained drift from an earlier abandoned attempt at
this feature. Repairs applied via one-off scripts (documented here, not committed
as migrations where they would break fresh databases):

1. Stray enum value `batch_status.'cancelled_by_supplier'` removed by type
   rebuild (drop trigger `batches_cancel_side_effects`, policies
   `batches_umkm_select` / `batch_tiers_umkm_select` /
   `batch_timeline_umkm_select`, SQL functions `search_batches`,
   `cancel_supplier_batch(uuid,uuid,text)`, `publish_supplier_batch(uuid,uuid)`
   → rename/create/convert/drop → reattach). The two dead functions from the
   abandoned attempt had zero references in app code.
2. NOT NULLs restored on `batches.title/category/min_quantity/pickup_address/
   latitude/longitude` and `supplier_profiles.nik` (4 null NIKs backfilled with
   deterministic md5 placeholders first).
3. Partial guard index `refund_requests_registration_supplier_cancel_idx`
   replaced by full unique `refund_requests_registration_unique` (partial
   indexes can't be inferred by `ON CONFLICT (registration_id)`).
4. **Latent repo bug fixed in-migration**: migration 0008's "replacement" of
   `approve_supplier` used different args than 0000's original, so
   CREATE OR REPLACE created an overload → PostgREST answered
   `300 Multiple Choices` for every rpc call (caught by live auth-rls test).
   `20260822000000_*.sql` now drops the legacy `approve_supplier(uuid)`.
5. `lucide-react` was declared but never installed → `npm install` unblocked
   the previously-broken build.

## Tooling added

- `scripts/apply-migration.mjs`: dollar-quote/comment-aware statement splitter
  that applies a SQL file tolerating already-applied statements. Used for all
  reconciliation above.

## Known limitations

- ILIKE patterns are used verbatim (parameterised but not escaped); acceptable
  at competition-MVP scale.
- Payment-confirm path must reject payments against non-published batches when
  that feature lands, to close the pay-after-cancel race.
- Fixture users in `tests/live/cancellation-search.integration.test.ts`
  (`*@cancelfix.test`) are reused rather than deleted because
  `admin_audit_logs` is append-only.
