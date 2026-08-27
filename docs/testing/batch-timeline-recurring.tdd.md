# TDD Evidence — Batch Timeline Validation & Recurring Shift

Date: 2026-08-26
Scope: PRD Modul Catalog & Campaign — absolute timeline validation on batch
creation, recurring timestamp shift calculation.

## Red

- `tests/unit/batch-timeline.test.ts` — 6 cases (valid linear order +
  normalization, non-object, missing field, unparseable, out-of-order,
  equal-adjacent). Failed: module `@/lib/batches/timeline` missing.
- `tests/unit/batch-recurring.test.ts` — 4 cases (+7d shift of all five
  params, shifted schedule still linearly valid, UTC time-of-day preserved,
  non-positive interval rejected). Failed: module missing.
- `tests/unit/api-batches-create.test.ts` — 5 cases (201 with normalized
  insert payload, 400 missing timeline, 400 unparseable, 400 close<open,
  400 payment window before registration cutoff). Failed: route accepted
  any strings.

## Green

Implementation:

- `lib/batches/timeline.ts` — `parseBatchTimeline()`: parses all five
  timestamps as absolute times, enforces strict increase
  Buka < Tutup < Mulai Payment < Batas Akhir Payment < Ready (PRD line
  "Time-Travel Validation", HTTP 400), returns ISO-normalized values.
- `app/api/batches/route.ts` — POST now gates insertion behind the parser.
- `lib/batches/recurring.ts` — `shiftBatchTimeline(timeline, days)`:
  adds N x 86400000 ms to every parameter (PRD: recurring posts shift all
  absolute time parameters by a fixed interval).

Result: 15/15 new tests pass; full suite 662/662 green; eslint clean
(1 pre-existing warning in app/page.tsx unrelated).

## Deliberate simplifications (ponytail)

- No future-time check on registration_opens_at — PRD mandates ordering
  only; publish_batch() refuses stale drafts whose window already started.
- Interval is fixed 24h days, no DST/calendar semantics — timestamps are
  stored as timestamptz (absolute); local-time shifting is out of scope.
- Cancellation fan-out (`CANCELLED_BY_SUPPLIER` behavior) reuses the
  existing `cancel_batch()` RPC + `handle_batch_cancellation()` trigger
  (migration 20260822000000) — verified by existing
  `api-supplier-cancel.test.ts`; no new code written for it.

## Round 2 — QA findings fixed (2026-08-26)

QA audit surfaced four findings; all resolved:

1. **Validator coercion bug** — numeric `0`, arrays, and non-date strings
   slipped through `Date.parse`. Fix: ISO-shaped string check before parse
   (`tests/unit/batch-timeline.test.ts`: +2 cases).
2. **No publish path** — batches were created as drafts with no way to go
   live; marketplace and registration only accept `published`. Fix:
   `publish_batch()` RPC (migration 20260826000000, applied to remote via
   pg connection) + `POST /api/suppliers/batches/[id]/publish`
   (`tests/unit/api-supplier-publish.test.ts`, 6 cases).
3. **Recurring unwired** — shift calculator had no consumer. Fix:
   `POST /api/suppliers/batches/[id]/repost` copies a previous batch into a
   new DRAFT with every timeline parameter shifted by `interval_days`
   (`tests/unit/api-supplier-repost.test.ts`, 5 cases).
4. **Mock-backed supplier detail page** — replaced mock repository with a
   real implementation (Supabase browser client + cancel API route);
   row→view-model mapping extracted into pure `mapSupplierBatchRow`
   (`tests/unit/supplier-batch-map.test.ts`, 3 cases).

Result: full suite 680/680 green (unit + migration contract + live
integration incl. remote `publish_batch`); eslint clean except one
pre-existing warning in app/page.tsx.
