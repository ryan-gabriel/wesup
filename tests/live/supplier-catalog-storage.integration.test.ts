import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const canConnect = Boolean(DATABASE_URL && SUPABASE_URL && PUBLISHABLE_KEY);

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  : null;

type AuthFixture = {
  email: string;
  password: string;
  id: string;
  client: SupabaseClient;
};

let owner: AuthFixture | null = null;
let otherSupplier: AuthFixture | null = null;
let batchId = "";
let objectPath = "";
let uploaded = false;
let setupError: unknown = null;

async function createAuthFixture(label: string): Promise<AuthFixture | null> {
  if (!canConnect) return null;
  const email = `storage-${label}-${Math.random().toString(36).slice(2, 10)}@example.com`;
  const password = "storage-test-password";
  const client = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!);
  const signUp = await client.auth.signUp({ email, password });
  if (!signUp.data.user) return null;
  let session = signUp.data.session;
  if (!session) {
    const signedIn = await client.auth.signInWithPassword({ email, password });
    session = signedIn.data.session ?? null;
  }
  if (!session) return null;

  await pool!.query(
    `update public.profiles
        set role = 'supplier', status = 'active'
      where id = $1`,
    [session.user.id],
  );
  await pool!.query(
    `insert into public.supplier_profiles
       (user_id, business_name, address, latitude, longitude, ktp_photo_url, nik, verification_status)
     values ($1, $2, 'Jl. Storage Test No. 1', -6.914744, 107.60981,
             'https://example.com/storage-test.jpg', $3, 'approved')
     on conflict (user_id) do update
       set verification_status = 'approved', business_name = excluded.business_name`,
    [session.user.id, `Storage ${label}`, `storage-${label}-${session.user.id}`],
  );

  return { email, password, id: session.user.id, client };
}

async function cleanup() {
  if (!pool) return;
  if (objectPath && owner) {
    await owner.client.storage.from("wesup-public").remove([objectPath]).catch(() => undefined);
  }
  if (batchId) {
    await pool.query("delete from public.batches where id = $1", [batchId]).catch(() => undefined);
  }
  const ids = [owner?.id, otherSupplier?.id].filter((id): id is string => Boolean(id));
  if (ids.length > 0) {
    await pool.query("delete from auth.users where id = any($1::uuid[])", [ids]);
  }
  await pool.end();
}

describe.skipIf(!canConnect)("live supplier catalog Storage policies", () => {
  beforeAll(async () => {
    try {
      owner = await createAuthFixture("owner");
      otherSupplier = await createAuthFixture("other");
      if (!owner || !otherSupplier) {
        setupError = new Error("Supabase sign-up did not return an authenticated session");
        return;
      }

      const now = Date.now();
      const timeline = {
        p_registration_opens_at: new Date(now + 86_400_000).toISOString(),
        p_registration_closes_at: new Date(now + 172_800_000).toISOString(),
        p_payment_opens_at: new Date(now + 190_800_000).toISOString(),
        p_payment_closes_at: new Date(now + 259_200_000).toISOString(),
        p_estimated_ready_at: new Date(now + 345_600_000).toISOString(),
      };
      const created = await owner.client.rpc("create_supplier_batch", {
        p_title: `Storage policy fixture ${now}`,
        p_description: "Fixture untuk pengujian upload Storage",
        p_category: "Sayur & Buah",
        p_min_quantity: 10,
        p_pickup_name: "Gudang Storage Test",
        p_pickup_address: "Jl. Storage Test No. 1",
        p_latitude: -6.914744,
        p_longitude: 107.60981,
        ...timeline,
        p_tiers: [
          { tier_number: 1, min_volume: 1, max_volume: 9, price_per_unit: 10000 },
          { tier_number: 2, min_volume: 10, max_volume: null, price_per_unit: 9000 },
        ],
      });
      if (created.error || !created.data) throw created.error ?? new Error("batch was not created");
      batchId = String(created.data);
      objectPath = `products/${batchId}/storage-policy-fixture-${now}.webp`;
    } catch (error) {
      setupError = error;
    }
  });

  afterAll(cleanup);

  it("allows an approved supplier to upload its own WebP object", async () => {
    if (setupError || !owner) return;
    const file = new File(["RIFFxxxxWEBP"], "storage-policy-fixture.webp", { type: "image/webp" });
    const result = await owner.client.storage.from("wesup-public").upload(objectPath, file, {
      contentType: "image/webp",
      upsert: false,
    });
    expect(result.error).toBeNull();
    expect(result.data?.path).toBe(objectPath);
    uploaded = true;
  });

  it("rejects an anonymous upload to an owned batch path", async () => {
    if (setupError || !batchId) return;
    const anonymous = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!);
    const result = await anonymous.storage.from("wesup-public").upload(
      `products/${batchId}/anonymous.webp`,
      new File(["RIFFxxxxWEBP"], "anonymous.webp", { type: "image/webp" }),
      { contentType: "image/webp", upsert: false },
    );
    expect(result.error).not.toBeNull();
  });

  it("rejects another supplier from uploading to the owned batch path", async () => {
    if (setupError || !otherSupplier || !batchId) return;
    const result = await otherSupplier.client.storage.from("wesup-public").upload(
      `products/${batchId}/other.webp`,
      new File(["RIFFxxxxWEBP"], "other.webp", { type: "image/webp" }),
      { contentType: "image/webp", upsert: false },
    );
    expect(result.error).not.toBeNull();
  });

  it("allows the owner to delete its object and publish through the Marketplace read model", async () => {
    if (setupError || !owner || !batchId) return;
    expect(uploaded).toBe(true);
    const publicUrl = owner.client.storage.from("wesup-public").getPublicUrl(objectPath).data.publicUrl;
    const published = await owner.client.rpc("publish_supplier_batch", {
      p_batch_id: batchId,
      p_product_photo_url: publicUrl,
    });
    expect(published.error).toBeNull();

    const marketplace = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!);
    const found = await marketplace.rpc("search_batches", { p_query: "Storage policy fixture" });
    expect(found.error).toBeNull();
    expect((found.data ?? []).some((row: { id: string }) => row.id === batchId)).toBe(true);

    const removed = await owner.client.storage.from("wesup-public").remove([objectPath]);
    expect(removed.error).toBeNull();
    objectPath = "";
  });
});
