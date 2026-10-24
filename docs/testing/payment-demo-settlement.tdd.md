# Payment demo settlement — TDD evidence

## Behavior and boundaries

The order detail has a separate **Pembayaran lunas** sandbox action. A successful persisted checkout, an active UMKM owner, an allowlisted batch, explicit sandbox mode and the payment window are required. The default remains disabled. Neither the client nor request body controls invoice amount or owner. Checkout, provider reconciliation and demo settlement share the same payment lock.

The new service-only RPC reuses the incumbent payment writers and transaction. It checks invoice/checkout/window again under row locks. Simulated payments use a `DEMO:` transaction identifier, `manual` log source, `payment_demo_simulation` operation, actor and request reference. Existing price, preparation, pickup and escrow-release rules are preserved. Audit rows remain append-only.

No migration, demo configuration, test account or settlement was applied to the hosted database. No commit or push was performed.

## RED → GREEN

| Regression | RED evidence | GREEN evidence |
| --- | --- | --- |
| Fail-closed demo eligibility and mismatch diagnostics | New unit suite failed because the demo module did not exist | Eligibility cases cover flags, allowlists, inactive accounts, missing/failed/expired checkouts, legacy QR, invoice mismatch, time and terminal states |
| Separate UI action | Existing payment-panel suite failed to find the new button | Disabled before checkout; absent for users without capability; independent of provider error |
| Midtrans HTTP 200 with error payload | Three adapter tests failed: promises resolved for embedded 404/401/500 | Embedded provider errors now throw the existing provider error type and reach the established reconcile failure/404 branches |
| Orders list refresh | List regression failed after dispatching a settlement event | Local event and cross-tab storage event refresh list and summary; focus, visibility and pageshow also refresh |

### Actual provider diagnosis (read-only)

Three latest pending payment attempts were compared with the official Midtrans status endpoint without changing their state or logging identifiers/credentials. Two returned HTTP 200 without transaction fields. A follow-up verified the latest response contained `status_code: "404"` and no `transaction_status`. The adapter previously looked only at HTTP status, then treated that body as invoice data, producing a misleading mismatch. This proves an active instance of the failure; the original screenshot's request ID was not independently available.

The adapter now honors embedded error codes. Real order/amount/currency/merchant/fraud mismatches remain rejected. Safe reconciliation logging records only request ID and mismatch category.

## Database and browser evidence

`node tests/database/payment-demo.mjs` executes the real existing payment writers plus the new migration inside PGlite. **27 checks passed**, including Snap, Core QRIS and legacy settlement, one escrow/notification on replay, explicit audit actor/source, exact closing boundary, before opening, invoice mismatch, takedown/cancellation, expired/missing/superseded checkout, different owner, suspended actor, late pending event and rollback after a notification failure. `authenticated` cannot invoke the RPC. An attempt with no persisted Core QRIS image cannot settle.

PGlite serializes requests: the concurrent Promise submissions prove replay behavior, not independent PostgreSQL sessions contending on locks. Hosted PostgreSQL concurrency and deployment verification remain release checks.

The isolated loopback UI fixture runs the real payment panel and real SQL writers, with a stubbed checkout/provider. It does not use Supabase credentials. Browser checks completed:

- Settlement disabled before checkout, then enabled after checkout creation.
- Provider-check failure leaves the separate eligible demo action available.
- Keyboard opens the confirmation with order reference, amount and sandbox notice.
- Confirmation updates persisted status to **Lunas · barang disiapkan**; status remains after reload. The fixture's Supplier summary reads the same database state.
- 320/390/768/1440 px: no document/dialog overflow; visible action buttons at least 44 px high.
- Reviewed screenshots: `payment-demo-settlement/{width}-{checkout,confirm,paid}.jpg`. These are initial reviewed evidence, not automatically updated baselines.

This component/SQL fixture is not an authenticated end-to-end test of the deployed Next.js UMKM and Supplier pages. Existing route/component suites cover those boundaries separately. A disposable hosted smoke test is still required after deployment, including the actual Supplier view and pickup schedule.

New-code coverage before the final list-refresh addition: **98.48% lines, 92.85% statements, 85.15% branches, 82.35% functions** for demo eligibility, endpoint and action. Coverage used explicit include filters rather than claiming project-wide percentages.

## Reproduction and rollout

The isolated SQL runtime is the same pinned PGlite 0.3.14 cache used by marketplace checks. If absent, install it with:

```powershell
npm install --prefix node_modules/.cache/wesup-availability --no-save --package-lock=false @electric-sql/pglite@0.3.14
node tests/database/payment-demo.mjs
```

To reproduce browser checks, run `node tests/database/payment-demo.mjs --serve` and open `http://127.0.0.1:3217`. This fixture starts empty; create checkout first. Restart it for a fresh disposable database. It never targets a hosted environment.

Before enabling the real feature:

1. Validate and apply `20261024160000_demo_payment_settlement.sql` on the intended sandbox database, after the existing payment/audit migrations. Verify only service role has RPC execute access.
2. Deploy the app. Leave `PAYMENT_DEMO_ENABLED=false` initially and verify the panel is absent and endpoint denied.
3. Set `MIDTRANS_IS_PRODUCTION=false`, `PAYMENT_DEMO_ENABLED=true`, and comma-separated UUID allowlists `PAYMENT_DEMO_ALLOWED_UMKM_IDS` / `PAYMENT_DEMO_ALLOWED_BATCH_IDS` for disposable fixtures only. Missing, empty, wildcard or malformed lists disable the feature. No `NEXT_PUBLIC_` flags are used.
4. Smoke-test checkout → demo confirmation → order list/summary → Supplier view → preparation/pickup eligibility. Verify one escrow and demo audit source. Test an unlisted account/batch and disable the flag again.

A parallel build/test attempt exhausted Node memory; tests were rerun with bounded workers. Final `npm.cmd test -- --maxWorkers=4`: **245 files / 2271 tests passed**. Final `npx tsc --noEmit` and final `npm run build` passed; `npm run lint` completed with **0 errors / 15 existing warnings**. `git diff --check` passed. Build preflight only read the existing hosted schema; the new migration remains unapplied there.

Additional final regressions verify that a refreshed snapshot still marked pending is never reported as paid, and that Snap capability is disabled if its private checkout session is missing, cancelled or unreadable. Snap token and allowlists are not exposed by that capability check.
