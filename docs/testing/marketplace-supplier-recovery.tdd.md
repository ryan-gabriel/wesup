# TDD Evidence Report — Marketplace API & Supplier Registration Recovery

## Scope

This iteration addresses two production symptoms on branch `marketplace`:

1. `GET /api/marketplace/search` returned HTTP 500 when the deployed Supabase RPC
   signature did not match the application read model.
2. `POST /api/suppliers/register` returned a generic failure because the server-side
   Supabase admin key was not configured.

## Changes and guarantees

| Area | Implementation | Evidence |
|---|---|---|
| Marketplace error boundary | Logs only structured RPC metadata; returns a safe `MARKETPLACE_QUERY_FAILED` response for normal failures and a `MARKETPLACE_SCHEMA_OUTDATED` 503 for `PGRST202`. | `tests/unit/api-marketplace-search.test.ts` |
| Marketplace read model | The existing migration `20260908000000_marketplace_dynamic_read_model.sql` remains the source of the nine-argument RPC contract. Remote status must be synchronized before live data can be returned. | `tests/migrations/marketplace-read-model.test.ts`; migration list audit |
| Admin configuration | `resolveSupabaseAdminConfiguration()` trims values, prefers `SUPABASE_SECRET_KEY`, falls back to `SUPABASE_SERVICE_ROLE_KEY`, and throws a typed configuration error when either value is missing. | `tests/unit/supabase-admin-config.test.ts` |
| Supplier service | Registration failures are stage-labelled (`configuration`, `email_lookup`, `auth_signup`, `photo_upload`, `profile_insert`) and rollback behavior remains intact. | `tests/unit/supplier-registration-service.test.ts` |
| Supplier route | Configuration failures return HTTP 503 with `SUPPLIER_REGISTRATION_NOT_CONFIGURED`; other internal failures return HTTP 500 with a safe code and no provider details. | `tests/unit/api-supplier-registration.test.ts` |

## Verification

```text
npm test -- tests/unit/api-marketplace-search.test.ts tests/unit/marketplace-api-repository.test.ts
  2 files passed, 21 tests passed

npm test -- tests/unit/supabase-admin-config.test.ts tests/unit/supplier-registration-service.test.ts tests/unit/api-supplier-registration.test.ts
  3 files passed, 11 tests passed

npm test -- tests/unit tests/migrations
  41 files passed, 580 tests passed

npx tsc --noEmit
  passed

npm run build
  passed; /marketplace, /api/marketplace/search, /api/suppliers/register compiled
```

`npm run lint` completed with zero errors and the repository's existing warnings only.

## Operational prerequisite

The remote database still needs the two pending migrations applied with the official
Supabase CLI before the new Marketplace RPC is available remotely:

- `20260831030000_fulfillment_pickup.sql`
- `20260908000000_marketplace_dynamic_read_model.sql`

The local `.env` currently has no `SUPABASE_SECRET_KEY` or
`SUPABASE_SERVICE_ROLE_KEY`; a server-only admin key must be supplied in `.env.local`
for supplier registration to proceed. No secret is committed by this change.
