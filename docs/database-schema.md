# Wesup — Supabase Schema Overview

This document explains every table in the Wesup Supabase project, the storage buckets, how they relate to each other, and how data flows through them from the frontend and backend.

## 1. Foundation: Enums (shared vocabulary)

Defined in migration `20260731000100_core_types_profiles.sql`. Every status column in the system draws from these:

| Enum | Values | Used by |
|---|---|---|
| `user_role` | `supplier`, `umkm`, `admin` | `profiles.role` |
| `account_status` | `active`, `suspended_temporary`, `suspended_permanent`, `banned` | `profiles.status` |
| `verification_status` | `pending`, `approved`, `rejected` | `supplier_profiles` |
| `batch_status` | `draft`, `published`, `closed`, `cancelled`, `takedown`, `completed` | `batches.status` |
| `registration_status` | `registered` → `pending_payment` → `paid` → `picked_up` → `completed` / `no_show` / `cancelled` / `refund_pending` / `refunded` | `registrations.status` |
| `payment_status` | `pending`, `paid`, `expired`, `failed`, `refunded` | `payments.status` |
| `escrow_status` | `held`, `released`, `refunded`, `forfeited` | `escrow_holds.status` |
| `dispute_status` | `pending`, `under_review`, `resolved_supplier`, `resolved_umkm` | `disputes.status` |
| `refund_trigger` | `takedown`, `force_majeure`, `dispute_won` | `refund_requests.trigger_type` |
| `refund_status` | `pending`, `waiting_bank_account`, `processing`, `completed`, `failed` | `refund_requests.status` |
| `notification_type` | `payment_due`, `payment_success`, `pickup_ready`, `dispute`, `refund`, `suspension`, `referral`, `batch_update` | `notifications.type` |
| `audit_action` | `verify_supplier`, `reject_supplier`, `takedown_batch`, `resolve_dispute`, `approve_refund`, `complete_refund`, `suspend_user`, `ban_user`, `unban_user` | `admin_audit_logs.action_type` |

## 2. Tables by Module

### Module 1 — IAM (migration 0001)

**`profiles`** — one row per `auth.users` account. Auto-created by the `handle_new_user()` trigger on signup. The root of the identity graph: every other table links back to it via `user_id`/`supplier_id`/`umkm_id`/`admin_id` → `profiles(id)`.

| Column | Purpose |
|---|---|
| `id` | `= auth.users.id` (1:1 with Supabase Auth) |
| `role` | supplier / umkm / admin |
| `status` | active / suspended / banned |
| `full_name`, `phone` | basic identity |

RLS: user sees only own row; admin sees all (`is_admin()` helper).

**`supplier_profiles`** — KYC data, 1:1 with profiles (`user_id` PK). Holds the storage URLs:

- `ktp_photo_url text` → points to `wesup-assets/ktp/{user_id}/{file}`
- `business_photo_url text` → points to `wesup-assets/business/{user_id}/{file}`
- `nik` unique (global NIK duplication check), `verification_status`, `verified_by/at`, `is_location_locked`

**`supplier_bank_accounts`** / **`umkm_bank_accounts`** — disbursement (supplier payout) and refund destinations (UMKM). 1:N with profiles.

**`umkm_profiles`** — consumer record: `strike_count` (Hit-and-Run), `suspended_until`, business address + coordinates.

### Module 2 — Catalog & Campaign (migration 0002)

**`recurring_configs`** — auto-repost schedule (e.g. every Mon & Thu): `interval_days`, `days_of_week`, `next_generation_at`.

**`batches`** — the core offer entity. The central node of the commerce graph:

- `supplier_id → profiles(id)`
- `recurring_config_id → recurring_configs(id)`
- `product_photo_url text` → points to **`wesup-public/products/{batch_id}/{file}`**
- `latitude/longitude` (Bandung-bounded pin), `status`, takedown fields

**`batch_tiers`** — N:M via `batch_id`. Volume-based discount levels (Tier 1 = base price). `unique(batch_id, tier_number)`; cross-tier rules (decreasing price, non-overlapping volume) enforced at the API layer (PRD 3.6).

**`batch_timeline`** — 1:1 with batches (`batch_id` PK). The absolute timestamps: `registration_opens < registration_closes < payment_opens < payment_closes < estimated_ready`. The DB check constraint `batch_timeline_linear_order` rejects time-travel at the schema level.

### Module 3 & 4 — Orders (migration 0003)

**`registrations`** — the UMKM↔batch join record. The transactional spine:

- `unique(batch_id, umkm_id)` — one join per user per batch
- `consented_at`, `consent_latitude/longitude` — location consent audit trail
- `locked_tier_number`, `locked_price_per_unit`, `final_amount` — price frozen at cutoff
- `status` walks the full lifecycle: `registered → pending_payment → paid → picked_up → completed | no_show | refund_pending | refunded`

**`registration_counters`** — persistent mirror of the Redis atomic counter (`batch_id` PK, `current_count`). Redis INCR is the runtime source of truth; this table enables recovery/reconciliation.

### Module 5 — Payment (migration 0004)

**`payments`** — 1:1 with registrations (`registration_id` UNIQUE). One QRIS invoice per registration:

- `midtrans_order_id` (UNIQUE), `midtrans_transaction_id`
- `gross_amount` — the exact locked `final_amount`
- `qr_code_url`, `qr_code_expires_at`, `paid_at`, `reconciled_at`
- `webhook_payload jsonb` — raw Midtrans callback stored for audit

**`payment_webhook_logs`** — append-only log of every Midtrans callback (payload jsonb, status, error).

### Module 6 — Fulfillment (migration 0005)

**`pickup_codes`** — 1:1 with registrations. `qr_code_token` (UNIQUE) + `pin_code` (validated `^[0-9]{4}$`). Only generated after payment confirmed. `used_at`, `used_by_supplier_id` mark the handover.

**`pickup_events`** — physical handover log: `method` (`qr`/`pin`), `supplier_id`, GPS coordinates. The **first event starts the 24h escrow timer**.

### Module 7 — Escrow & Disputes (migration 0006)

**`escrow_holds`** — 1:1 with registrations. The money hold:

- `amount`, `pickup_confirmed_at`, `auto_release_at` (= pickup + 24h)
- `status`: `held → released | refunded | forfeited`
- `release_destination` (`supplier`/`umkm`), `dispute_id` link

**`disputes`** — 1:1 with registrations (`registration_id` UNIQUE). Quality complaints:

- `photo_urls jsonb` → array of URLs → each points to **`wesup-assets/disputes/{dispute_id}/{n}`**
- `umkm_id`, `supplier_id` (both denormalized for RLS simplicity), `status`, `admin_id/notes/decided_at`

**`dispute_evidence`** — additional attachments (1:N with disputes):

- `file_url text` → points to **`wesup-assets/dispute-evidence/{evidence_id}/{file}`**
- `uploaded_by` — whoever uploaded

### Module 8 — Refunds & Ratings (migration 0007)

**`refund_requests`** — manual refund queue. Triggered only by `takedown`, `force_majeure`, `dispute_won`:

- `registration_id`, `batch_id`, `trigger_type`, `amount`
- `umkm_bank_account_id` (bank account supplied by UMKM after approval), `admin_id`, `admin_notes`
- `transfer_proof_url` — admin uploads proof of off-system bank transfer

**`ratings`** — post-transaction stars: `score 1–5`, `unique(registration_id)` (one rating per transaction), `comment`.

### Module 9 & 10 — Notifications & Audit (migration 0008)

**`notifications`** — in-app center (WhatsApp fallback): `type`, `title`, `message`, `data jsonb`, `read_at`, `sent_via_whatsapp`.

**`admin_audit_logs`** — append-only (triggers block UPDATE/DELETE/TRUNCATE): `action_type`, `target_type/id`, `details jsonb`, `ip_address`, `user_agent`. Written exclusively by the server-side `write_audit_log()` security-definer function (no client INSERT policy — dropped in migration 0009), which asserts the caller is an admin and the admin id matches `auth.uid()`.

### Module 11 — Admin Action RPCs (migration 0009)

Admin actions are executed through **security-definer SQL functions** (`app/api/admin/*` routes call them via `.rpc()`). Each function performs the state transition and appends an `admin_audit_logs` row **in the same transaction**, so an action is never recorded unless it succeeded. All functions assert `public.is_admin()` and validate inputs; timestamps are set server-side with `now()` (audit records cannot be backdated by the client) — the one exception is `suspend_user`, whose `suspended_until` is a client-supplied absolute timestamp validated by the API Gatekeeper (`isIsoTimestamp` + future check in the function).

| Function | Effect | Audit action |
|---|---|---|
| `approve_supplier(p_supplier_id, p_admin_id, p_ip, p_user_agent, p_details)` | `supplier_profiles.verification_status → 'approved'` | `verify_supplier` |
| `reject_supplier(p_supplier_id, p_reason, ...)` | `→ 'rejected'` + `verification_notes` | `reject_supplier` |
| `takedown_batch(p_batch_id, p_reason, ...)` | `batches.status → 'takedown'` (not from takedown/completed/cancelled) + `takedown_reason/by/at` | `takedown_batch` |
| `resolve_dispute(p_dispute_id, p_winner, p_notes, ...)` | `disputes.status → resolved_supplier / resolved_umkm` + `admin_id/admin_notes/decided_at`; escrow hold `→ 'released'` with `release_destination` + `dispute_id` (refund flow continues via refund queue) | `resolve_dispute` |
| `approve_refund(p_refund_id, ...)` | `refund_requests.status → 'waiting_bank_account'` (no bank account on file) or `'processing'` | `approve_refund` |
| `complete_refund(p_refund_id, p_transfer_proof_url, ...)` | `→ 'completed'` + `transfer_proof_url` | `complete_refund` |
| `suspend_user(p_user_id, p_suspended_until, ...)` | `profiles.status → 'suspended_temporary'` + `umkm_profiles.suspended_until` (only from active/suspended_temporary) | `suspend_user` |
| `ban_user(p_user_id, ...)` | `profiles.status → 'banned'` | `ban_user` |
| `unban_user(p_user_id, ...)` | `profiles.status → 'active'` (only from banned) | `unban_user` |
| `write_audit_log(...)` | appends a row (no state change) | as supplied |

Grant model: EXECUTE on all of the above is revoked from `public`/`anon` and granted only to `authenticated`; `write_audit_log` additionally requires the caller to be an admin. `admin_audit_logs` keeps FORCE RLS with client access read-only (SELECT for admins); the INSERT policy was dropped so client-side rows cannot be forged.

## 3. How Tables Relate — The Transaction Spine

```
auth.users
   └── profiles (role: supplier | umkm | admin)
         ├── supplier_profiles ──► wesup-assets/ktp/        (KTP photo)
         │       │                 wesup-assets/business/   (business photo)
         │       ├── supplier_bank_accounts
         ├── umkm_profiles
         │       └── umkm_bank_accounts
         └── batches (supplier's offer)
               ├── batch_tiers       (discount levels)
               ├── batch_timeline    (absolute clock)
               ├── recurring_configs (auto-repost)
               │
               └── registrations (UMKM joins)  ◄── THE CORE
                     ├── registration_counters (Redis mirror)
                     ├── payments ── payment_webhook_logs (Midtrans)
                     ├── pickup_codes ── pickup_events (QR/PIN scan)
                     ├── escrow_holds (24h hold)
                     ├── disputes ── dispute_evidence
                     │       └── ► wesup-assets/disputes/, dispute-evidence/
                     ├── refund_requests (manual refund queue)
                     └── ratings (1 per transaction)
```

One transaction = one `registration` row pulling together ~8 related rows.

## 4. Storage Buckets & Their Link to Tables

Two buckets are created by migration `20260731000900_storage_buckets.sql`:

| Bucket | Public? | Folder | Linked from | Who can write | Who can read |
|---|---|---|---|---|---|
| `wesup-assets` | **no** | `ktp/` | `supplier_profiles.ktp_photo_url` | owner supplier, admin | owner, admin |
| | | `business/` | `supplier_profiles.business_photo_url` | owner supplier, admin | owner, admin |
| | | `disputes/` | `disputes.photo_urls[]` | UMKM of dispute, admin | both parties, admin |
| | | `dispute-evidence/` | `dispute_evidence.file_url` | uploader, admin | uploader, counterparty, admin |
| | | `archive/` | *(soft-deleted files)* | admin only | admin only |
| `wesup-public` | **yes** | `products/` | `batches.product_photo_url` | batch supplier, admin | **anyone (anon)** |

Common bucket settings: `file_size_limit` = 20 MB (2× the 10 MB client-side compressed cap), `allowed_mime_types` = `image/jpeg`, `image/png`, `image/webp`. HEIC/HEIF are rejected at the bucket level; the frontend converts them to WebP before upload.

### How storage authorization mirrors table RLS

The binding mechanism: the table stores a *URL string* (`product_photo_url`, `photo_urls[]`, `file_url`), and the *path* embeds the related record's UUID (`products/{batch_id}/...`, `disputes/{dispute_id}/...`). The storage RLS helper functions extract that UUID from the object path and look it up in the corresponding table:

| Helper function | Folder | Lookup |
|---|---|---|
| `storage_is_owner` | `ktp/`, `business/` | segment 2 == `auth.uid()` |
| `storage_is_batch_supplier` | `products/` | `batches.id = path_id` AND `supplier_id = auth.uid()` |
| `storage_is_dispute_umkm` | `disputes/` | `disputes.id = path_id` AND `umkm_id = auth.uid()` |
| `storage_is_dispute_counterparty` | `disputes/` | `disputes.id = path_id` AND `umkm_id` OR `supplier_id` = uid |
| `storage_is_evidence_uploader` | `dispute-evidence/` | `dispute_evidence.id = path_id` AND `uploaded_by = auth.uid()` |
| `storage_is_evidence_counterparty` | `dispute-evidence/` | join `dispute_evidence → disputes`, either party |
| `storage_is_admin` | all + `archive/` | wraps `public.is_admin()` |

`storage_path_id(name)` extracts the UUID from the second path segment via regex, returning null for malformed paths (so checks fail closed, never error).

### Soft-delete / history

Objects are never hard-deleted with their rows. The app moves a file to `archive/{orig_folder}/{path}_{timestamp}` before removing the DB record, and only admins can read `archive/` — this preserves audit history while freeing the original path.

## 5. Data Flow Examples

### Example A — Supplier registers + uploads KTP (frontend)

1. **Frontend** (client): user picks photo → compressed client-side (10MB cap, PRD 2.4.2) → converted to WebP.
2. **Upload to storage** (anon key, signed-in user):

   ```js
   const { data } = await supabase.storage
     .from('wesup-assets')
     .upload(`ktp/${user.id}/${crypto.randomUUID()}.webp`, blob);
   // path: ktp/<user_id>/<uuid>.webp
   ```

   Storage RLS `storage_objects_ktp_insert` checks: path segment 2 == `auth.uid()` → **allowed**.

3. **Insert row** (RLS `supplier_profiles_insert_own` — `user_id = auth.uid()`):

   ```js
   await supabase.from('supplier_profiles').insert({
     user_id: user.id,
     business_name, address, latitude, longitude,
     nik,                                          // unique — dup rejected
     ktp_photo_url: data.path,                     // ← stored path into the bucket
     business_photo_url: '/business/.../x.webp',
     verification_status: 'pending'
   });
   ```

4. **Storage**: object `ktp/<user_id>/<uuid>.webp` in `wesup-assets` + row in `supplier_profiles`.
5. **Read later** (private): frontend requests a signed URL — `createSignedUrl('ktp/...', 3600)`; admin reads via RLS.

### Example B — Supplier creates a batch with product photo (frontend)

1. Upload photo → `wesup-public/products/{batch_id}/...` — the batch row must exist first: insert batch → get `batch.id` → upload photo → update `product_photo_url` (or generate a UUID client-side and insert the batch with that id).
2. Insert `batches` (RLS `batches_supplier_all`), `batch_tiers` (2+ tiers), `batch_timeline` (the DB check constraint validates linear order).
3. **Public read** (no auth needed — this is why the bucket is public):

   ```js
   supabase.storage.from('wesup-public').getPublicUrl(`products/${batch.id}/${file}`)
   // → https://<ref>.supabase.co/storage/v1/object/public/products/<id>/<file>
   ```

### Example C — UMKM joins a batch (frontend + backend)

1. Frontend sends `POST /api/registrations` with `{ batchId, quantity, consentCoords }`.
2. Backend (Next.js API route): validates Gatekeeper timestamps → `redis.INCR(batch:<id>:count)` (atomic) → upsert `registration_counters` → insert `registrations` with `consented_at = server timestamp`:

   ```js
   await supabase.from('registrations').insert({
     batch_id, umkm_id, quantity,
     consented_at: serverNow, consent_latitude, consent_longitude,
     status: 'registered'
   });
   ```

3. At cutoff, backend locks `locked_tier_number`, `locked_price_per_unit`, `final_amount` (under Redis SETNX distributed lock) and updates the row.

### Example D — Payment webhook (backend ← Midtrans)

1. Midtrans `POST /api/webhook/midtrans` → backend verifies signature → inserts `payment_webhook_logs` (append-only raw payload) → updates `payments.status = 'paid'`, `paid_at`, `midtrans_transaction_id` → updates `registrations.status = 'paid'`.
2. Payment window closed → Gatekeeper reconciles via Midtrans API → applies Hit-and-Run strikes to `umkm_profiles.strike_count` (and suspends at strike 2/3 per PRD 3.4).

### Example E — Pickup QR scan (frontend at pickup point)

1. Supplier scans QR → `POST /api/pickup` → validate token → insert `pickup_events` (`method: 'qr'`) → mark `pickup_codes.used_at`, `registrations.status = 'picked_up'`.
2. Backend inserts `escrow_holds`: `amount = final_amount`, `pickup_confirmed_at = now`, `auto_release_at = now + 24h`, `status = 'held'`.
3. 24h later, on any relevant API call (lazy evaluation), if `auto_release_at` passed and no dispute → `status = 'released'`, `release_destination = 'supplier'`.

### Example F — Dispute with photo evidence (frontend)

1. UMKM (within 24h) uploads photos → `wesup-assets/disputes/{dispute_id}/1.webp` (RLS: `storage_is_dispute_umkm`).
2. Inserts `disputes` with `photo_urls = jsonb` array of stored paths, `status = 'pending'` → escrow `status` frozen (suspended).
3. Additional files → `dispute_evidence` rows, each `file_url` → `wesup-assets/dispute-evidence/{evidence_id}/...`.
4. Admin (arbiter) views both parties' evidence via RLS, decides → `disputes.status` = resolved_supplier/umkm → escrow released/refunded.

### Example G — Refund & archive (admin)

1. Refund triggered (takedown/force majeure/dispute won) → `refund_requests` inserted with `status='pending'`, `trigger_type`.
2. UMKM fills bank account → links `umkm_bank_account_id`.
3. Admin transfers manually off-system → updates `refund_requests.status='completed'`, `completed_at`, and stores `transfer_proof_url`.
4. If a supplier deletes a product photo: frontend copies object to `archive/products/{old-path}_{ts}` (admin-only read), then deletes the original from `wesup-public` and clears `batches.product_photo_url`.

## 6. Key Design Patterns

1. **URL-in-column, object-in-bucket** — tables never store blobs; they store paths, so storage and DB scale independently.
2. **RLS everywhere** — every table + `storage.objects` is row-level secured; `security definer` helper functions (`is_admin`, `storage_is_batch_supplier`, …) keep checks DRY and bypass RLS only inside the check.
3. **Status as enum state machines** — lifecycle is enforced by enum values + API Gatekeeper timestamps, not cron jobs (lazy evaluation, PRD 3.1).
4. **Denormalized ids for RLS** — `disputes` stores both `umkm_id` and `supplier_id` so policies don't need multi-table joins.
5. **Append-only where it matters** — `payment_webhook_logs`, `admin_audit_logs` (trigger-blocked mutations), `archive/` storage folder.
6. **Path-embedded record ids** — storage paths encode the owning record UUID so storage policies can validate ownership against the related table.
