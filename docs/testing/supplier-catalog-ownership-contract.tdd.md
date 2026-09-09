# Supplier Catalog Ownership Contract — TDD Evidence

## Red

Added `tests/migrations/supplier-catalog-ownership-contract.test.ts` before the
follow-up migration existed.

```text
npx vitest run tests/migrations/supplier-catalog-ownership-contract.test.ts --reporter=verbose
Test Files  1 failed
Tests       9 failed
```

The failures were expected: the additive ownership-contract migration and its
RPCs did not yet exist.

## Green

Added `20260909010000_supplier_catalog_ownership_contract.sql`, including:

- private owner and active-approved-supplier assertions;
- `P0002` missing-batch and `42501` cross-owner errors;
- `22023` validation and `55000` lifecycle errors for hardened mutations;
- narrowed grants for the public RPCs and no direct helper execution; and
- the supplier dashboard aggregate RPC.

```text
npx vitest run tests/migrations/supplier-catalog-ownership-contract.test.ts tests/migrations/supplier-catalog-persistence.test.ts tests/migrations/schema.test.ts --reporter=verbose
Test Files  3 passed (3)
Tests       196 passed (196)

npx tsc --noEmit
exit 0
```

No Supabase project was migrated as part of this task.

## Review-fix cycle

The expanded migration-contract assertions initially failed for five review
regressions (URL regex, list RPC, tier/timeline SQLSTATEs, direct DML, and
summary arithmetic). A final dispute-freeze assertion also failed before the
escrow eligibility guard was added.

```text
npx vitest run tests/migrations/supplier-catalog-ownership-contract.test.ts tests/migrations/supplier-catalog-persistence.test.ts tests/migrations/schema.test.ts --reporter=verbose
Test Files  3 passed (3)
Tests       201 passed (201)

npx tsc --noEmit
exit 0

git diff --check
exit 0
```

## Scoped re-review round 1

The new regression assertions first exposed that a null or missing
`tier_number` could bypass the nullable SQL comparison and fail later at the
column constraint, while JSON scalar casts could raise native PostgreSQL
errors. The validator now checks JSON types and integer/decimal representations
before casting, catches range/text conversion failures as `22023`, and remains
before every catalog-table insert or update. The source contracts also assert
all five timeline-null guards and require the dispute exclusion to remain
inside the ready-to-disburse aggregate's `NOT EXISTS` predicate.

```text
npx vitest run tests/migrations/supplier-catalog-ownership-contract.test.ts tests/migrations/supplier-catalog-persistence.test.ts tests/migrations/schema.test.ts --reporter=verbose
Test Files  3 passed (3)
Tests       203 passed (203)

npx tsc --noEmit
exit 0

git diff --check
exit 0
```

Local PostgreSQL remains unavailable, so these are precise source-contract
assertions rather than executable migration/RLS checks.

## Final scoped re-review

The final source-contract pass first failed on the missing required-key guard
and on the deliberately scoped ready-to-disburse FILTER extraction. The tier
validator now explicitly requires `tier_number`, `min_volume`, and
`price_per_unit` keys before type/cast checks, accepts only a value representable
by `numeric(12,2)`, and continues to normalize validation errors to `22023`.
The contract now rejects absent validation/DML anchors before comparing their
order and extracts the dispute predicate from the escrow FILTER before asserting
its `NOT EXISTS` contents.

```text
npx vitest run tests/migrations/supplier-catalog-ownership-contract.test.ts tests/migrations/supplier-catalog-persistence.test.ts tests/migrations/schema.test.ts --reporter=verbose
Test Files  3 passed (3)
Tests       204 passed (204)

npx tsc --noEmit
exit 0

git diff --check
exit 0
```

No local PostgreSQL instance is available, so validation, SQLSTATE, RLS, and
aggregate behavior retain precise static-contract coverage only.