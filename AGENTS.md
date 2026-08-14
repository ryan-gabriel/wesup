<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Product Requirements (PRD)

Product requirements live in `prd/` as Markdown files (e.g. `prd/feature-name.md`). PRDs are private working documents — do not commit changes under `prd/`. When implementing a feature, consult the PRD first and align code and decisions with it.

# Project Context

Wesup — group-buying platform for UMKM (Indonesian small businesses): suppliers post volume-tiered batch offers, UMKM register and pay (QRIS) during fixed windows, pickup is self-service at the supplier's location (Bandung only). Competition entry for INSEVENT 2026 (SDG 8). Full product spec: `prd/PRD.md` (private — do not commit changes).

## Tech stack

- Next.js 16.2 (App Router + API routes, React 19), TypeScript, Tailwind 4
- Supabase (Postgres + Auth + Storage), Upstash Redis (REST)
- Vitest 4 for tests; ESLint 9

## Current state (Aug 2026)

- 10 Supabase migrations in `supabase/migrations/` (core types/profiles, catalog, orders, payments, fulfillment, escrow/disputes, refunds/ratings, notifications/audit, storage buckets, auth RLS hardening). Schema documented in `docs/database-schema.md`
- Auth layer: `lib/supabase/client.ts`, `lib/supabase/server.ts` (cookie-based server client, structural DI), `lib/supabase/auth.ts` (role/status guards, `AuthError`), `proxy.ts` (session refresh), 6 auth routes under `app/api/auth/`
- `lib/redis.ts`: Upstash client (throws if env vars missing)
- `scripts/seed-admin.mjs`: admin seeding
- Test suite green: unit + migration + live integration tests (Supabase, Redis, auth RLS)

## Architectural rules (from PRD — apply to all backend work)

- Lazy Evaluation: no cron jobs; state transitions computed on-demand in API routes
- API Gatekeeper: validate absolute timestamps on every sensitive endpoint
- Redis atomic counters (INCR) + distributed lock (SETNX) to prevent race conditions
- Tier prices lock at registration cutoff; fall back to Tier 1 (base price)
- 24h escrow after pickup; auto-release, dispute freeze, No-Show forfeiture
- Hit-and-Run auto-suspend escalation (warning → 7-day suspend → permanent)

## Conventions

- TDD: write tests first, keep TDD evidence reports in `docs/testing/*.tdd.md`
- Schema contract tests live in `tests/helpers/schema-contract.ts`
- PRDs are private working documents; do not commit changes under `prd/`. `.env` is git-ignored — never commit secrets

## Commands

- `npm run dev` / `npm run build` / `npm run lint` / `npm test` (vitest run)
- Live tests (`tests/live/*`) need real Supabase + Upstash credentials in `.env`

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
