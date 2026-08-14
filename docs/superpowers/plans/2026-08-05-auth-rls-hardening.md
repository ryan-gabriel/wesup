# Wesup Auth & RLS Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable email/password Supabase Auth via API route handlers, harden RLS role separation (admin/supplier/umkm), and enforce account status (ban/suspend) — no UI.

**Architecture:** DB-level hardening migration (role escalation prevention, supplier promotion on KYC approval, active-status enforcement in role helpers) + `@supabase/ssr` cookie session layer (`lib/supabase/server.ts`, `proxy.ts`) + DI-friendly auth helpers in `lib/supabase/auth.ts` + thin `app/api/auth/*` route handlers + idempotent admin seed script.

**Tech Stack:** Next.js 16.2.10 (App Router, `proxy.ts` not `middleware.ts`), `@supabase/ssr` (new dep), `@supabase/supabase-js` 2.111, PostgreSQL/RLS, Vitest 4, `pg` (devDep).

## Global Constraints

- **Next.js 16 is NOT training-data Next.js** — read `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, `02-guides/authentication.md`, `15-route-handlers.md` before writing any app code (AGENTS.md)
- TDD: test-first, RED gate before implementation, checkpoint commits per stage (`test:` then `feat:`), ≥80% coverage, evidence report at `docs/testing/auth-rls.tdd.md`
- Test runner: `npm test` (vitest, include `tests/**/*.test.ts`), coverage `npm run test:coverage`, lint `npm run lint`
- Migration naming: `20260805000000_auth_rls_hardening.sql` (14-digit timestamp, ordered, no DROP/TRUNCATE)
- No UI pages. No comments in code. Env vars: `NEXT_PUBLIC_SITE_URL` added to `.env.example` (fallback `http://localhost:3000`)

---

### Task 0: Docs, spec, and plan artifacts

**Files:** Create `docs/superpowers/specs/2026-08-05-auth-rls-hardening-design.md`, `docs/superpowers/plans/2026-08-05-auth-rls-hardening.md`

- [ ] Read the 3 Next.js docs listed in Global Constraints + `node_modules/@supabase/ssr` README. Note exact `proxy.ts` and server-client cookie APIs — they drive Tasks 2–4
- [ ] Write the approved design doc (from the design above) and this plan file verbatim
- [ ] `git add` both + commit `chore: add auth rls design spec and implementation plan`

---

### Task 1: Migration 0010 — RLS & auth hardening (TDD)

**Files:**
- Create: `supabase/migrations/20260805000000_auth_rls_hardening.sql`
- Modify: `tests/helpers/schema-contract.ts` (REQUIRED_FUNCTIONS, REQUIRED_TRIGGERS)
- Create: `tests/migrations/rls-hardening.test.ts` (static assertions)
- Create: `tests/live/auth-rls.integration.test.ts` (live behavior, `describe.skipIf` env-gated)

**Interfaces:** Produces SQL objects: `handle_new_user()` (role always `'umkm'`), `is_admin()`/`is_supplier()` (require `status='active'`), `approve_supplier(uuid)` RPC (admin-gated, security definer), `promote_supplier_on_approval()` + trigger on `supplier_profiles` (`after insert or update of verification_status`), column grants on `profiles` and `supplier_profiles`.

- [ ] **RED** — Add to `schema-contract.ts`:
  ```ts
  REQUIRED_FUNCTIONS.push("promote_supplier_on_approval", "approve_supplier");
  REQUIRED_TRIGGERS.push({ name: "promote_supplier_on_approval", table: "supplier_profiles" });
  ```
  New `tests/migrations/rls-hardening.test.ts` (reads raw migration SQL via regex):
  - `handle_new_user` body contains `'umkm'` and does **not** match `raw_user_meta_data ->> 'role'`
  - file contains `REVOKE UPDATE ON public.profiles` and `GRANT UPDATE (full_name, phone, updated_at) ON public.profiles`
  - `is_admin` and `is_supplier` bodies contain `status = 'active'`
  - file contains `REVOKE INSERT, UPDATE ON public.supplier_profiles` and the column-level `GRANT INSERT (user_id, business_name, address, latitude, longitude, business_photo_url, ktp_photo_url, nik)` and `GRANT UPDATE (business_name, address, latitude, longitude, business_photo_url, ktp_photo_url, nik, updated_at)`
  - `approve_supplier` body contains `public.is_admin()` and `verification_status = 'approved'`
  - Run: `npm test` → expect these to FAIL (RED: assertions on missing SQL)
- [ ] **Commit** `test: assert rls hardening requirements in schema contract`
- [ ] **GREEN** — Write the migration (exact content):
  ```sql
  create or replace function public.handle_new_user() returns trigger
    language plpgsql security definer as $$
  begin
    insert into public.profiles (id, full_name, phone, role)
    values (new.id,
            coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
            new.phone, 'umkm')
    on conflict (id) do nothing;
    return new;
  end;
  $$;

  revoke update on public.profiles from authenticated;
  grant update (full_name, phone, updated_at) on public.profiles to authenticated;

  revoke insert, update on public.supplier_profiles from authenticated;
  grant insert (user_id, business_name, address, latitude, longitude, business_photo_url, ktp_photo_url, nik)
    on public.supplier_profiles to authenticated;
  grant update (business_name, address, latitude, longitude, business_photo_url, ktp_photo_url, nik, updated_at)
    on public.supplier_profiles to authenticated;

  create or replace function public.approve_supplier(p_user_id uuid) returns void
    language plpgsql security definer as $$
  begin
    if not public.is_admin() then
      raise exception 'only an active admin may approve suppliers';
    end if;
    update public.supplier_profiles
       set verification_status = 'approved',
           verified_by = auth.uid(),
           verified_at = now(),
           updated_at = now()
     where user_id = p_user_id;
  end;
  $$;

  revoke execute on function public.approve_supplier(uuid) from public, anon;
  grant execute on function public.approve_supplier(uuid) to authenticated;

  create or replace function public.is_admin() returns boolean
    language sql stable security definer as $$
    select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
  $$;

  create or replace function public.is_supplier() returns boolean
    language sql stable security definer as $$
    select exists (select 1 from public.profiles where id = auth.uid() and role = 'supplier' and status = 'active');
  $$;

  create or replace function public.promote_supplier_on_approval() returns trigger
    language plpgsql security definer as $$
  begin
    if new.verification_status = 'approved' then
      update public.profiles set role = 'supplier' where id = new.user_id and role = 'umkm';
    end if;
    return new;
  end;
  $$;

  create trigger promote_supplier_on_approval
    after insert or update of verification_status on public.supplier_profiles
    for each row execute function public.promote_supplier_on_approval();
  ```
- [ ] **GREEN check** — `npm test` → all pass (static + parse + no-destructive)
- [ ] **Live behavior tests** (`tests/live/auth-rls.integration.test.ts`, skipIf no env): using `createClient(url, publishableKey)` signUp a random email; if `signUp` returns no session (email confirmation enabled), retry `signInWithPassword`; if still no session, skip the authenticated block via `describe.skipIf`. Then:
  - PATCH `/rest/v1/profiles?id=eq.<uid>` `{"role":"admin"}` with user token → expect status ≥ 400 (column grant blocks escalation)
  - PATCH `{"full_name":"Updated"}` → expect status < 300, then verify via GET that `full_name` = `"Updated"` (own-row update allowed)
  - POST `/rest/v1/supplier_profiles` with own `user_id` + business payload only → expect 201 (own KYC submission allowed); then POST again with `"verification_status":"approved"` in payload → expect status ≥ 400 (column insert grant blocks self-approval); then PATCH `{"verification_status":"approved"}` on own row → expect status ≥ 400 (column update grant blocks self-approval); then PATCH `{"business_name":"...2"}` → expect status < 300 (legitimate KYC editing preserved)
  - RPC `approve_supplier` with own uid as non-admin → expect error (`only an active admin may approve suppliers`)
  - via `pg` pool: insert `supplier_profiles` row (fresh user) with `verification_status='approved'` → query `profiles.role` = `'supplier'` (trigger fires on INSERT as service role)
  - promote to admin + set `status='banned'` via pool → REST `GET /rest/v1/profiles` with that user's token → expect exactly 1 row and it is the user's own id (own-row policy still applies; `is_admin()` now false so no other user is visible)
  - cleanup: delete test auth users via pool
  - Run `npm test tests/live/auth-rls.integration.test.ts` (needs env; if env absent, document as skipped)
- [ ] **Apply to remote** (with user confirmation): `npx supabase db push`
- [ ] **Commit** `feat: harden auth rls role separation and supplier promotion`

---

### Task 2: Server client + session proxy

**Files:**
- Create: `lib/supabase/server.ts`, `proxy.ts`
- Create: `tests/unit/server.test.ts`

**Interfaces:**
- Produces: `getServerClient(): Promise<SupabaseClient<Database>>` (cookie-based, `await cookies()` — Next 16 async API)
- Produces: `proxy.ts` default export `updateSession(request: NextRequest): Promise<NextResponse | undefined>`; config `export const config = { matcher: [...] }` excluding `_next/static|_next/image|favicon.ico` (exact API from the docs read in Task 0)

- [ ] **RED** — `tests/unit/server.test.ts`: `vi.mock("next/headers")` returning `{ getAll: () => [], set: vi.fn() }`; assert `getServerClient()` resolves to an object with `auth` and `from`; assert it throws when env vars missing (stub env like `tests/unit/client.test.ts`)
- [ ] Run → FAIL. **GREEN** — implement `server.ts` per Task 0 doc findings. Run `npm test tests/unit/server.test.ts` → PASS. Commit `test: server client factory` / `feat: add cookie-based server client`
- [ ] **GREEN** — implement `proxy.ts` session refresh using `createServerClient` + `getUser()`, copying refreshed cookies via `setAll`. No unit test (thin, config-covered); verify via `npm run build` in Task 6. Commit `feat: add session refresh proxy`

---

### Task 3: Auth helpers (DI-friendly) — TDD

**Files:** Create `lib/supabase/auth.ts`, `tests/unit/auth.test.ts`

**Interfaces:**
- `class AuthError extends Error { constructor(public status: 401 | 403, message: string) }`
- `interface AuthContext { userId: string; email: string; role: UserRole; status: AccountStatus; fullName: string }`
- `getCurrentUser(client): Promise<AuthContext | null>` — `client.auth.getUser()` (carry `user.email` into the context) + `client.from("profiles").select("role,status,full_name").eq("id", userId).single()`
- `requireRole(client, roles: UserRole[]): Promise<AuthContext>` — throws `AuthError(401)` no session, `AuthError(403)` role not in `roles` or `status !== "active"`
- `requireActive(client): Promise<AuthContext>` — throws `AuthError(401)` no session, `AuthError(403)` if `status !== "active"` (message includes the status)
- `toAuthResponse(err: unknown): NextResponse` — maps `AuthError` → `{ error }` JSON with status; else 500

- [ ] **RED** — `tests/unit/auth.test.ts` with a hand-rolled fake client (`{ auth: { getUser: vi.fn() }, from: () => ({ select: () => ({ eq: () => ({ single: () => ({ data, error }) }) }) }) }`). Cases: returns null when no session; returns context when active; 401 no session; 403 wrong role; 403 suspended/banned; `toAuthResponse` maps 401/403/500. Run → FAIL
- [ ] **Commit** `test: auth helper access rules`
- [ ] **GREEN** — implement `auth.ts`. Run `npm test tests/unit/auth.test.ts` → PASS. **Commit** `feat: add role and status auth helpers`

---

### Task 4: Auth API routes — TDD

**Files:** Create `app/api/auth/signup/route.ts`, `login/route.ts`, `logout/route.ts`, `forgot-password/route.ts`, `reset-password/route.ts`, `session/route.ts`, `tests/unit/api-auth.test.ts`

**Interfaces:** Consumes Task 3 helpers + `getServerClient()` (mocked in tests via `vi.mock("@/lib/supabase/server")`).

| Route | Body → Response |
|---|---|
| `POST /api/auth/signup` | `{email,password,full_name,phone?}` → 201 `{user}`; 400 validation (email regex, password ≥ 8, full_name required); 409 email exists (Supabase `user_already_exists`) |
| `POST /api/auth/login` | `{email,password}` → 200 `{user}`; 401 invalid credentials |
| `POST /api/auth/logout` | → 200 `{ok:true}` |
| `POST /api/auth/forgot-password` | `{email}` → 200 always (no user enumeration); uses `resetPasswordForEmail(email, { redirectTo: (env NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") + "/reset-password" })` |
| `POST /api/auth/reset-password` | `{code,password}` → `exchangeCodeForSession(code)` then `updateUser({password})` → 200; 400 on invalid/expired; on `updateUser` failure, `signOut()` before returning 400 (no half-signed-in state) |
| `GET /api/auth/session` | 200 `{user: {email}, profile: {role,status,full_name}}` (email from `AuthContext.email`, single `getUser`); 401 unauthenticated; 403 `{error, reason: status}` when not active |

- [ ] **RED** — `tests/unit/api-auth.test.ts`: mock server client; per route: validation failures, success shapes, error mapping (login 401, signup 409, session 401/403/200). Call handlers directly with `new NextRequest("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify(...) })`. Run → FAIL
- [ ] **Commit** `test: auth api route contracts`
- [ ] **GREEN** — implement the 6 routes (thin wrappers over Task 3 + `supabase.auth`). Run → PASS. **Commit** `feat: add auth api route handlers`

---

### Task 5: Admin seed script

**Files:** Create `scripts/seed-admin.mjs`

- [ ] Script: Node + `pg` + `DATABASE_URL`; usage `node scripts/seed-admin.mjs <email>`; looks up `auth.users` by email (error if absent, with "sign up first" hint), sets `profiles.role='admin'`, `status='active'`; idempotent; `--remove` flag reverts role to `'umkm'`
- [ ] Verify: `node --check scripts/seed-admin.mjs` passes (no unit test — script is glue; live smoke optional with user-provided email)
- [ ] **Commit** `feat: add admin seed script`

---

### Task 6: Env, full verification, evidence report

**Files:** Modify `.env.example` (add `NEXT_PUBLIC_SITE_URL=`), create `docs/testing/auth-rls.tdd.md`

- [ ] Add env var + document in evidence report
- [ ] Full suite: `npm test` (all green), `npm run test:coverage` (≥80% on `lib/**/*.ts`; add `tests/unit/server.test.ts`/`auth.test.ts`/`api-auth.test.ts` coverage if short), `npm run lint`, `npm run build` (validates `proxy.ts` + routes)
- [ ] Write `docs/testing/auth-rls.tdd.md` per tdd-workflow Step 8: journeys, task→test→RED/GREEN evidence table, coverage result, known gaps (proxy.ts untested by unit tests — covered by build + manual smoke)
- [ ] **Commit** `chore: finalize auth rls tdd evidence report`
