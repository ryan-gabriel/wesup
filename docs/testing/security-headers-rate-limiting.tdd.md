# TDD Evidence Report — Rate Limiting & Security Headers

**Task:** Close two findings from the Aug 2026 security review: (1) no rate limiting on any API endpoint despite the PRD mandating Redis atomic counters, and (2) no security headers (CSP/HSTS/X-Frame-Options/etc.) configured. Scope approved in-session: nonce-based strict CSP via `proxy.ts`, fail-open limiter on Redis outage, full endpoint coverage.

**Source plan:** No persisted plan file — produced and user-approved in-session (CSP approach, Redis-outage behavior, endpoint scope confirmed via structured questions). Requirements trace to the security review checklist and `prd/PRD.md` §3.6 API Gatekeeper / architectural rules ("Redis atomic counters (INCR)").

## User journeys

1. As a platform operator, I want login/signup/password-reset attempts throttled per IP, so that credential stuffing and email bombing are impractical. (`login` 5/min, `signup` 5/hour, `forgot-password` 3/15min, `reset-password` 10/15min)
2. As an admin, I want admin action RPCs throttled per authenticated admin, so that a compromised admin session cannot spam state transitions or audit rows. (`admin` 30/min across all 11 `/api/admin/*` routes)
3. As an attacker, I want my marketplace scraper to be slowed down, so that catalog enumeration is costly. (`search` 60/min per user-or-IP)
4. As a legitimate user during a Redis incident, I want API calls to keep working, so that an infrastructure outage does not lock everyone out of their accounts. (fail-open)
5. As a visitor, I want the site served with strict CSP (per-request script nonces), HSTS, frame-deny, and no MIME sniffing, so that XSS and clickjacking have no room to operate.

## Design decisions

- **Atomic counter via Lua EVAL** (`INCR` → `EXPIRE` on first hit → `TTL` read in one server-side script) instead of a plain INCR+EXPIRE pipeline: matches the existing pattern in `lib/supplier-registration/rate-limit.ts`, avoids TTL refresh under sustained load, satisfies the PRD's atomic-counter rule. The supplier-registration module was left untouched (it already rate-limits that route; wiring a second limiter there would double-throttle).
- **Fail-open** on Redis errors (user-approved): availability over strictness; logged via `console.error`.
- **SHA-256 hashed identifiers** in keys (consistent with supplier-registration; keeps raw emails/IPs out of Redis).
- **Dev bypass** (`NODE_ENV=development`) consistent with the existing module so local development is not locked out by the 5/min login window.
- **Nonce CSP through proxy.ts** per this Next.js version's official guide (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`): proxy generates the nonce, sets CSP on request+response headers; Next auto-attaches the nonce to framework/bundle scripts. Consequence accepted: all 6 pages forced to dynamic rendering (static pages cannot receive nonces).
- `style-src 'self' 'unsafe-inline'`: React inline style attributes cannot be nonced; documented exception.
- `img-src https://*.tile.openstreetmap.org`: required by Leaflet map tiles.
- Admin routes: auth first (`requireRole`), then limiter keyed by `authCtx.userId`, so unauthenticated traffic cannot pollute per-admin buckets.

## Task report

| Plan task | Execution summary | Validation command | Result |
|-----------|-------------------|--------------------|--------|
| Static security headers | `next.config.ts` `headers()`: HSTS (2y, preload), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY` on all routes. | curl against dev server | PASS — all 5 headers present |
| Nonce CSP | New `lib/security/csp.ts` (nonce gen + policy builder); `proxy.ts` rewritten to set `x-nonce` + CSP on forwarded request headers and response; matcher extended with prefetch exclusion per docs. | build + curl + grep page HTML | PASS — per-request nonce in header and injected into `<script nonce>` tags |
| Dynamic rendering sweep | Added `export const dynamic = "force-dynamic"` to all 6 pages (home, login, marketplace, leaflet demo, supplier register, supplier batch detail). | `npm run build` route table | PASS — every app route `ƒ (Dynamic)`; only Next's internal `/_not-found` remains static |
| Rate-limit unit tests (RED) | Wrote `tests/unit/rate-limit.test.ts` — 12 tests: key format/TTL args, allow/block/remaining, resetAt from key TTL, non-positive-TTL fallback, fail-open, identifier precedence (userId → first x-forwarded-for IP → x-real-ip → unknown), 429 + Retry-After shape. | `npx vitest run tests/unit/rate-limit.test.ts` | **RED** (module absent) → **GREEN** after implementation; one real bug caught mid-green: TTL `-1` passed the `\|\|` fallback as truthy → fixed with explicit `> 0` check |
| `lib/rate-limit.ts` | General-purpose fixed-window limiter: `RATE_LIMITS` scope table, `checkRateLimit` (Lua EVAL, hashed key `ratelimit:{scope}:{sha256}`, dev bypass, fail-open), `resolveRateLimitIdentifier`, `enforceRateLimit` (returns `NextResponse(429)` with `Retry-After` or null). | unit tests | PASS |
| Wire into routes | 16 handlers guarded at top of handler: login, signup, forgot-password, reset-password, marketplace/search (identifier = ctx.userId ?? IP), 11 admin routes (codemod applied uniform `let authCtx` hoisting + limiter after `requireRole`; first codemod draft had a block-scoping bug — `const authCtx` inside `try` — caught by tests, fixed by second codemod pass). suppliers/register intentionally skipped (already limited by its own module). | `npm test` | PASS |
| Route-test mocks + 429 cases | Added `vi.mock("@/lib/rate-limit")` + default-null reset in beforeEach + one "returns 429" propagation test each to api-login, api-auth, api-admin, api-admin-refunds, api-marketplace-search (previously these hit the real limiter → live Upstash calls from unit tests). | `npm test` | PASS |
| Lint / typecheck / build | `npm run lint` · `npm run build`. One build error surfaced: `NextRequest` used as value while imported type-only in proxy.ts → converted to value import. | commands | PASS |
| Full suite | `npm test` | 22 files / 633 tests | ALL GREEN |

## Test specification (new)

### `tests/unit/rate-limit.test.ts` (12)

1. increments a hashed per-identity key with the scope window
2. allows when count is within limit and reports remaining
3. blocks when count exceeds limit
4. reports resetAt based on the key's remaining TTL
5. falls back to the full window when Redis returns no TTL
6. fails open when Redis throws
7. returns null when allowed
8. prefers userId over IP as identifier
9. returns 429 with Retry-After when blocked
10. uses only the first IP from x-forwarded-for
11. falls back to x-real-ip then unknown
12. fails open when Redis is unreachable

### Route-level additions (one per file)

- `api-login.test.ts`: returns 429 when the rate limiter blocks the request (asserts `signInWithPassword` never called)
- `api-auth.test.ts`: same for signup (asserts `signUp` never called)
- `api-admin.test.ts`: same for approve_supplier (valid UUID path past `isUuid`)
- `api-admin-refunds.test.ts`: same for GET refunds list
- `api-marketplace-search.test.ts`: same for search GET

## Live verification evidence

```
curl -sD - http://<dev>/login
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(self)
  X-Frame-Options: DENY
  content-security-policy: default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic' 'unsafe-eval'; …

curl -s http://<dev>/login | grep -oE 'nonce="[^"]+"'   → 3 matching nonced <script> tags
curl -sD - http://<dev>/api/marketplace/search?q=test  → 200, no CSP header (proxy excludes /api by design)
```

## Known limitations / follow-ups

- `_not-found` stays statically prerendered; its runtime scripts have no nonce. Cosmetic risk only (404 page hydration under strict-dynamic); acceptable for scope.
- `x-forwarded-for` is client-spoofable outside a trusted proxy; identifier quality depends on deployment platform (Vercel sets it authoritatively).
- Per-user search/admin limits share one Upstash instance with the escrow counters — negligible memory (hashed-key strings, short TTLs).
