import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

const noDbUrl = !DATABASE_URL;

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  : null;

const EMAIL_SUFFIX = "@cancelfix.test";

let supplierId = "";
let umkmAId = "";
let umkmBId = "";
let cancelBatchId = "";
let takedownBatchId = "";
let pickedUpBatchId = "";
let paidRegId = "";
let unpaidRegId = "";

async function sql<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool!.query<T>(text, params);
  return res.rows;
}

async function createUser(fullName: string, role: "supplier" | "umkm") {
  const [user] = await sql<{ id: string }>(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
             'authenticated', 'authenticated', $1, 'x')
     returning id`,
    [`${fullName.toLowerCase().replace(/\s+/g, "-")}${EMAIL_SUFFIX}`],
  );
  await sql(
    `insert into public.profiles (id, role, full_name) values ($1, $2, $3)
     on conflict (id) do update set role = excluded.role`,
    [user.id, role, fullName],
  );
  return user.id;
}

// admin_audit_logs is append-only and references profiles, so fixture
// users can never be deleted once they appear in an audit row. Reuse
// them instead.
async function ensureApprovedSupplierProfile(userId: string, fullName: string) {
  await sql(
    "insert into public.supplier_profiles\n       (user_id, business_name, address, latitude, longitude, ktp_photo_url, nik, verification_status)\n     values ($1, $2, 'Jl. Test No. 1', -6.914744, 107.60981, 'fixture', $3, 'approved')\n     on conflict (user_id) do update set verification_status = 'approved', business_name = excluded.business_name",
    [userId, fullName, `FX-${fullName.replace(/\s+/g, "-").toLowerCase()}-nik`],
  );
}
async function ensureUser(
  fullName: string,
  role: "supplier" | "umkm",
): Promise<string> {
  const email = `${fullName.toLowerCase().replace(/\s+/g, "-")}${EMAIL_SUFFIX}`;
  const existing = await sql<{ id: string }>(
    `select id from auth.users where email = $1`,
    [email],
  );
  if (existing.length > 0) {
    await sql(`update public.profiles set role = $2 where id = $1`, [
      existing[0].id,
      role,
    ]);
    if (role === "supplier") await ensureApprovedSupplierProfile(existing[0].id, fullName);
    return existing[0].id;
  }
  const id = await createUser(fullName, role);
  if (role === "supplier") await ensureApprovedSupplierProfile(id, fullName);
  return id;
}

async function createBatch(
  supplier: string,
  title: string,
  category: string,
  lat: number,
  lng: number,
  status: "published" | "draft" = "published",
): Promise<string> {
  const [batch] = await sql<{ id: string }>(
    `insert into public.batches
       (supplier_id, title, description, category, min_quantity,
        pickup_name, pickup_address, latitude, longitude, status)
     values ($1, $2, 'deskripsi', $3, 10, 'Pickup Test', 'Jl. Test No. 1', $4, $5, $6)
     returning id`,
    [supplier, title, category, lat, lng, status],
  );
  await sql(
    `insert into public.batch_tiers (batch_id, tier_number, min_volume, price_per_unit)
     values ($1, 1, 10, 25000), ($1, 2, 50, 22000)`,
    [batch.id],
  );
  await sql(
    `insert into public.batch_timeline
       (batch_id, registration_opens_at, registration_closes_at,
        payment_opens_at, payment_closes_at, estimated_ready_at)
     values ($1, now() - interval '3 days', now() - interval '2 days',
             now() - interval '1 day', now(), now() + interval '1 hour')`,
    [batch.id],
  );
  return batch.id;
}

async function createRegistration(
  batchId: string,
  umkmId: string,
  status: "registered" | "paid" | "pending_payment",
  finalAmount?: number,
): Promise<string> {
  // Fixtures model historical batches whose registration window has
  // already closed (pre-registration-gatekeeper data). Bypass triggers
  // and FK checks for the fixture insert only.
  const client = await pool!.connect();
  try {
    await client.query("begin");
    await client.query("set session_replication_role = replica");
    const res = await client.query<{ id: string }>(
      `insert into public.registrations
         (batch_id, umkm_id, quantity, consented_at, status, locked_tier_number,
          locked_price_per_unit, final_amount)
       values ($1, $2, 25, now(), $3, 1, 25000, $4)
       returning id`,
      [batchId, umkmId, status, finalAmount ?? null],
    );
    await client.query("set session_replication_role = default");
    await client.query("commit");
    return res.rows[0].id;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function actAs(userId: string, fn: () => Promise<void>) {
  await sql(`select set_config('role', 'authenticated', false)`);
  await sql(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  try {
    await fn();
  } finally {
    await sql(`select set_config('request.jwt.claims', '', false)`);
    await sql(`select set_config('role', 'postgres', false)`);
  }
}

async function purgeData(userIds: string[]) {
  if (!pool || userIds.length === 0) return;
  await sql(
    `delete from public.refund_requests where registration_id in (
       select r.id from public.registrations r
        where r.umkm_id = any($1::uuid[])
           or r.batch_id in (select b.id from public.batches b where b.supplier_id = any($1::uuid[])))`,
    [userIds],
  );
  await sql(
    `delete from public.escrow_holds e using public.registrations r
      where e.registration_id = r.id and r.umkm_id = any($1::uuid[])`,
    [userIds],
  );
  await sql(
    `delete from public.registrations where umkm_id = any($1::uuid[])
        or batch_id in (select b.id from public.batches b where b.supplier_id = any($1::uuid[]))`,
    [userIds],
  );
  await sql(
    `delete from public.batches where supplier_id = any($1::uuid[])`,
    [userIds],
  );
  for (const id of userIds) {
    await sql(`delete from public.notifications where user_id = $1`, [id]);
  }
}

async function cleanup() {
  if (!pool) return;
  await purgeData([supplierId, umkmAId, umkmBId].filter(Boolean));
}

describe.skipIf(noDbUrl)("live batch cancellation & search (pg)", () => {
  beforeAll(async () => {
    supplierId = await ensureUser("Fx Supplier", "supplier");
    umkmAId = await ensureUser("FxA", "umkm");
    umkmBId = await ensureUser("FxB", "umkm");
    // Clear leftovers from any earlier run (stale batches would poison
    // the search assertions below).
    await purgeData([supplierId, umkmAId, umkmBId]);

    // Batch A: one paid participant (with held escrow) + one unpaid.
    cancelBatchId = await createBatch(
      supplierId,
      "Cabai Merah Kirim",
      "Sayur & Buah",
      -6.914744,
      107.60981,
    );
    paidRegId = await createRegistration(
      cancelBatchId,
      umkmAId,
      "paid",
      50000,
    );
    unpaidRegId = await createRegistration(
      cancelBatchId,
      umkmBId,
      "registered",
    );
    await sql(
      `insert into public.escrow_holds
         (registration_id, amount, status, pickup_confirmed_at, auto_release_at)
       values ($1, 50000, 'held', now(), now() + interval '24 hours')`,
      [paidRegId],
    );

    // Batch B: will be taken down by direct status flip (admin parity).
    takedownBatchId = await createBatch(
      supplierId,
      "Bawang Merah Batch",
      "Sayur & Buah",
      -6.92,
      107.61,
    );
    await createRegistration(takedownBatchId, umkmAId, "paid", 120000);

    // Batch C: already picked up -> cancellation must be blocked.
    pickedUpBatchId = await createBatch(
      supplierId,
      "Tahu Tempe Grosir",
      "Makanan Siap Saji",
      -6.93,
      107.62,
    );
    const pickedUpRegId = await createRegistration(
      pickedUpBatchId,
      umkmAId,
      "paid",
      80000,
    );
    await sql(
      `update public.registrations set status = 'picked_up' where id = $1`,
      [pickedUpRegId],
    );

    // Search fixtures spread around Bandung. (No id tracking needed —
    // purgeData clears every batch owned by the fixture supplier.)
    await createBatch(supplierId, "Gula Pasir Premium", "Sayur & Buah", -6.9148, 107.6099);
    await createBatch(supplierId, "Ikan Segar Nusantara", "Daging & Ikan", -6.98, 107.63);
    await createBatch(supplierId, "Kerajinan Bambu Serut", "Kerajinan", -7.4, 108.2);
    await createBatch(
      supplierId,
      "Gula Aren Draft",
      "Sayur & Buah",
      -6.9148,
      107.6099,
      "draft",
    );
  });

  afterAll(cleanup);

  it("rejects cancel_batch without a session (auth.uid() null)", async () => {
    await expect(sql(`select public.cancel_batch($1, 'alasan')`, [cancelBatchId]))
      .rejects.toThrow(/sign in required/i);
  });

  it("rejects cancel_batch with an empty reason", async () => {
    await actAs(supplierId, async () => {
      await expect(sql(`select public.cancel_batch($1, '   ')`, [cancelBatchId]))
        .rejects.toThrow(/reason/i);
    });
  });

  it("blocks cancelling a batch whose goods were already picked up", async () => {
    await actAs(supplierId, async () => {
      await expect(
        sql(`select public.cancel_batch($1, 'force majeure')`, [pickedUpBatchId]),
      ).rejects.toThrow(/picked-up/i);
    });
  });

  it("refuses to cancel someone else's batch", async () => {
    await actAs(umkmAId, async () => {
      await expect(
        sql(`select public.cancel_batch($1, 'bukan milikku')`, [cancelBatchId]),
      ).rejects.toThrow(/batch access denied/i);
    });
  });

  it("fans out refunds, auto-cancels unpaid, notifies and reroutes escrow on supplier cancel", async () => {
    await actAs(supplierId, async () => {
      await sql(`select public.cancel_batch($1, 'gagal panen', '127.0.0.1', 'vitest')`, [
        cancelBatchId,
      ]);
    });

    const [batch] = await sql<{ status: string; cancelled_reason: string }>(
      `select status, cancelled_reason from public.batches where id = $1`,
      [cancelBatchId],
    );
    expect(batch.status).toBe("cancelled");
    expect(batch.cancelled_reason).toBe("gagal panen");

    const [paid] = await sql<{ status: string }>(
      `select status from public.registrations where id = $1`,
      [paidRegId],
    );
    expect(paid.status).toBe("refund_pending");

    const [unpaid] = await sql<{ status: string }>(
      `select status from public.registrations where id = $1`,
      [unpaidRegId],
    );
    expect(unpaid.status).toBe("cancelled");

    const refunds = await sql<{
      registration_id: string;
      trigger_type: string;
      amount: string;
      status: string;
    }>(
      `select registration_id, trigger_type::text, amount, status::text
        from public.refund_requests where batch_id = $1`,
      [cancelBatchId],
    );
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({
      registration_id: paidRegId,
      trigger_type: "supplier_cancel",
      amount: "50000.00",
      status: "pending",
    });

    const [escrow] = await sql<{ release_destination: string | null }>(
      `select release_destination from public.escrow_holds where registration_id = $1`,
      [paidRegId],
    );
    expect(escrow.release_destination).toBe("umkm");

    const notifs = await sql<{ user_id: string; type: string }>(
      `select user_id, type::text from public.notifications
        where data->>'batch_id' = $1 order by type::text`,
      [cancelBatchId],
    );
    expect(notifs).toHaveLength(2);
    expect(notifs.map((n) => n.type).sort()).toEqual(["batch_update", "refund"]);
  });

  it("appends exactly one audit row per supplier cancellation", async () => {
    const logs = await sql<{ action_type: string }>(
      `select action_type::text from public.admin_audit_logs
        where target_type = 'batches' and target_id = $1
          and action_type = 'cancel_batch'`,
      [cancelBatchId],
    );
    expect(logs).toHaveLength(1);
  });

  it("marks admin takedown refunds with the takedown trigger (PRD 3.5 parity)", async () => {
    await sql(
      `update public.batches set status = 'takedown',
         takedown_reason = 'pelanggaran', updated_at = now()
       where id = $1`,
      [takedownBatchId],
    );
    const refunds = await sql<{ trigger_type: string; status: string }>(
      `select trigger_type::text, status::text
        from public.refund_requests where batch_id = $1`,
      [takedownBatchId],
    );
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({
      trigger_type: "takedown",
      status: "pending",
    });
  });

  it("never queues two refund tickets for one registration (unique index)", async () => {
    await expect(
      sql(
        `insert into public.refund_requests
           (registration_id, batch_id, trigger_type, amount, status)
         values ($1, $2, 'force_majeure', 50000, 'pending')`,
        [paidRegId, cancelBatchId],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("searches by text and excludes drafts and non-published states", async () => {
    const rows = await sql<{ title: string }>(
      `select title from public.search_batches(p_query => 'gula')`,
    );
    expect(rows.map((r) => r.title)).toEqual(["Gula Pasir Premium"]);
  });

  it("filters by category allow-list overlap", async () => {
    const rows = await sql<{ title: string }>(
      `select title from public.search_batches(
         p_categories => array['Daging & Ikan']::text[])`,
    );
    expect(rows.map((r) => r.title)).toEqual(["Ikan Segar Nusantara"]);
  });

  it("orders by distance inside the radius and reports distance_km", async () => {
    const rows = await sql<{ title: string; distance_km: string }>(
      `select title, distance_km::text from public.search_batches(
         p_lat => -6.914744, p_lng => 107.60981, p_radius_km => 5)`,
    );
    const titles = rows.map((r) => r.title);
    // Cancelled earlier in this suite -> excluded by the status filter.
    expect(titles).not.toContain("Cabai Merah Kirim");
    expect(titles).toContain("Gula Pasir Premium");
    expect(titles).not.toContain("Ikan Segar Nusantara");

    const distances = rows.map((r) => Number(r.distance_km));
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    for (const d of distances) {
      expect(d).toBeLessThanOrEqual(5);
    }
  });

  it("paginates with total_count reflecting the full filtered set", async () => {
    const args =
      "p_lat => -6.914744, p_lng => 107.60981, p_radius_km => 50";
    const page1 = await sql<{ id: string; total_count: string }>(
      `select id, total_count::text from public.search_batches(
         ${args}, p_limit => 2, p_offset => 0)`,
    );
    const page2 = await sql<{ id: string; total_count: string }>(
      `select id, total_count::text from public.search_batches(
         ${args}, p_limit => 2, p_offset => 2)`,
    );
    const all = await sql<{ id: string }>(
      `select id from public.search_batches(${args}, p_limit => 50)`,
    );

    expect(page1.length).toBeLessThanOrEqual(2);
    expect(page2.length).toBeLessThanOrEqual(2);
    // Every page reports the same, full filtered-set size.
    expect(Number(page1[0].total_count)).toBe(all.length);
    expect(Number(page2[0].total_count)).toBe(all.length);
    // Pages partition the result without overlap and stay a subset of
    // the full filtered set (which may exceed the two fetched pages).
    const seen = new Set(page1.map((r) => r.id));
    for (const row of page2) {
      expect(seen.has(row.id)).toBe(false);
      seen.add(row.id);
    }
    const allIds = new Set(all.map((r) => r.id));
    for (const id of seen) {
      expect(allIds.has(id)).toBe(true);
    }
  });
});
