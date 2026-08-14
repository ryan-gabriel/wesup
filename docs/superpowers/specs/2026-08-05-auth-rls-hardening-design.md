# Wesup Auth & RLS Hardening — Design

Date: 2026-08-05
Status: Approved

## Problem

The Wesup database layer (migrations 0001–0009) already enables RLS on every business table with per-role policies, but the auth experience and role security have gaps:

1. **Role escalation**: the `handle_new_user()` trigger copies `raw_user_meta_data->>'role'` into `profiles.role`, letting any client self-assign `admin` or `supplier`. The `profiles_update_own` policy also lets users edit their own `role`/`status` columns.
2. **No app-layer auth**: no `@supabase/ssr`, no server client, no session refresh proxy (Next 16 `proxy.ts`), no auth API, no role guards.
3. **Ban/suspend not enforced**: PRD 2.3.5 requires banned accounts to be blocked; nothing currently blocks them from authenticating and querying.
4. **No admin bootstrap** path.
5. **No supplier promotion path**: PRD 2.1.1 requires Supplier status to be gated behind Admin physical verification (KYC approval).

## Decisions

- **Role model (user-approved)**: UMKM self-signup is the only self-serve path. The supplier role is granted only by the DB trigger when `supplier_profiles.verification_status` becomes `approved` (Admin KYC approval). Admin roles are created only via a service-role seed script.
- **Scope (user-approved)**: API only — no UI pages.
- **Ban/suspend enforcement**: `is_admin()`/`is_supplier()` require `status = 'active'`; app-level `requireRole`/`requireActive` helpers reject non-active accounts with 403; `GET /api/auth/session` returns 403 with the reason.

## Design

### 1. DB hardening migration — `supabase/migrations/20260805000000_auth_rls_hardening.sql`

- Rewrite `handle_new_user()` to always create `role = 'umkm'` (ignore client metadata).
- `revoke update on public.profiles from authenticated` + `grant update (full_name, phone, updated_at) on public.profiles to authenticated` — users can only edit identity fields on their own row; `role`/`status` are service-role-only.
- Harden `is_admin()`/`is_supplier()` to require `status = 'active'`.
- New `promote_supplier_on_approval()` trigger on `supplier_profiles` (`after insert or update of verification_status`): when `verification_status = 'approved'`, promote `profiles.role` to `'supplier'` (guarded by `role = 'umkm'` so it never demotes an admin).

### 2. Server-side auth library + session refresh

- Add dependency `@supabase/ssr`.
- `lib/supabase/server.ts` — cookie-based `getServerClient()` for the App Router (Next 16 async `cookies()`).
- `lib/supabase/auth.ts` — DI-friendly helpers (client passed in, so they are unit-testable without network): `getCurrentUser(client)`, `requireRole(client, roles)`, `requireActive(client)`, `AuthError(status, message)`, `toAuthResponse(err)`.
- `proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`) — refresh the Supabase session on every request (matcher excludes static assets).

### 3. Auth API route handlers — `app/api/auth/*`

| Route | Purpose |
|---|---|
| `POST /api/auth/signup` | email+password+name → signUp (role always `umkm` via trigger) |
| `POST /api/auth/login` | email+password → session (PKCE) |
| `POST /api/auth/logout` | destroy session |
| `POST /api/auth/forgot-password` | reset email (redirect URL from env) |
| `POST /api/auth/reset-password` | `exchangeCodeForSession(code)` then `updateUser({password})` |
| `GET /api/auth/session` | `{ user, profile: { role, status } }` or 401/403 |

Future role-separated module routes (e.g. `POST /api/supplier/profiles`) use `requireRole()`.

### 4. Admin seed script — `scripts/seed-admin.mjs`

Idempotent Node script using `pg` + `DATABASE_URL` (already a devDep): looks up an existing user by email and promotes `profiles.role` to `'admin'` (password is set by the user via normal signup first — avoids bcrypt generation). `--remove` reverts to `'umkm'`.

### 5. Tests

- **Unit (vitest)**: auth helpers (fake client DI — allow/reject per role, suspended/banned rejected, 401/403 mapping); server client factory (mocked `next/headers`); route handler contracts (mocked server client, `NextRequest`).
- **Schema contract additions**: `promote_supplier_on_approval` in REQUIRED_FUNCTIONS/REQUIRED_TRIGGERS; static assertions that the migration hardens the trigger, adds column grants, and requires active status in helpers.
- **Live integration** (env-gated, existing `describe.skipIf` pattern): real signup via REST → role-escalation PATCH blocked, own `full_name` PATCH allowed, KYC approval promotes role via trigger, banned admin loses admin visibility.

### 6. Env & config

- `.env.example` adds `NEXT_PUBLIC_SITE_URL` (password-reset redirect base; code falls back to `http://localhost:3000`).
- `package.json` adds `@supabase/ssr`.

## Non-Goals

- No UI pages, no route-group dashboards.
- No changes to existing per-table RLS policies beyond the four hardening changes above.
- No service-role key handling (seed script uses `DATABASE_URL` pooler, which the repo already uses in tests).
