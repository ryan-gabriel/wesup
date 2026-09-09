# TDD Evidence Report — Supplier Registration Recovery

## Scope

The supplier registration path now distinguishes a missing server-side Supabase
admin key from downstream Auth, Storage, and database failures. Provider details are
kept in server logs; the browser receives stable Indonesian messages and error codes.

## Test evidence

| Guarantee | Test | Result |
|---|---|---|
| URL and one admin key are required; values are trimmed and current secret key wins | `tests/unit/supabase-admin-config.test.ts` | PASS (3 tests) |
| Successful registration creates a pending supplier profile; lookup, upload, and insert failures are stage-labelled | `tests/unit/supplier-registration-service.test.ts` | PASS (5 tests) |
| Upload/insert failures retain Storage/Auth rollback behavior | `tests/unit/supplier-registration-service.test.ts` | PASS |
| Missing admin config returns HTTP 503 without secret details | `tests/unit/api-supplier-registration.test.ts` | PASS |
| Internal registration failure returns HTTP 500 with a stable safe code | `tests/unit/api-supplier-registration.test.ts` | PASS |

Commands:

```text
npm test -- tests/unit/supabase-admin-config.test.ts tests/unit/supplier-registration-service.test.ts tests/unit/api-supplier-registration.test.ts
  3 files passed, 11 tests passed

npm test -- tests/unit tests/migrations
  41 files passed, 580 tests passed

npx tsc --noEmit
  passed

npm run build
  passed
```

`npm run lint` completed with zero errors and only existing repository warnings.

## Runtime prerequisite

The current local `.env` contains the publishable Supabase key but neither
`SUPABASE_SECRET_KEY` nor `SUPABASE_SERVICE_ROLE_KEY`. Supplier registration will
therefore return `SUPPLIER_REGISTRATION_NOT_CONFIGURED` (503) until an admin key for
the same Supabase project is added to `.env.local` or the deployment secret store.

No seeder is required for a first supplier registration, and no secret or `.env`
file is committed.

## Live smoke status

No live registration was attempted in this iteration because it creates an Auth user
and Storage object. A controlled smoke test needs an explicitly approved tester email,
admin key, and cleanup plan. The remote schema migrations for Marketplace also remain
pending until the database owner authorizes `supabase db push`.
