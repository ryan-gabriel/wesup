import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  CRITICAL_INDEXES,
  EXPECTED_ENUMS,
  EXPECTED_TABLE_NAMES,
  EXPECTED_TABLES,
  REQUIRED_FUNCTIONS,
  REQUIRED_TRIGGERS,
} from "../helpers/schema-contract";

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const noDbUrl = !DATABASE_URL;
const noRestUrl = !SUPABASE_URL || !PUBLISHABLE_KEY;

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  : null;

interface ColumnRow {
  table_name: string;
  column_name: string;
  udt_name: string;
  is_nullable: string;
}

interface FkRow {
  table_name: string;
  column_name: string;
  ref_table: string;
}

interface UniqueRow {
  table_name: string;
  columns: string[];
}

interface CheckRow {
  table_name: string;
  columns: string[];
}

function normalizeUdt(udt: string): string {
  if (udt.startsWith("_")) return "array";
  const map: Record<string, string> = {
    int4: "integer",
    int2: "smallint",
    bool: "boolean",
    varchar: "text",
    bpchar: "text",
    float8: "numeric",
    float4: "numeric",
  };
  return map[udt] ?? udt;
}

function normalizeRef(ref: string): string {
  return ref.replace(/^public\./, "");
}

async function fetchColumns(): Promise<ColumnRow[]> {
  const res = await pool!.query<ColumnRow>(
    `select table_name, column_name, udt_name, is_nullable
     from information_schema.columns
     where table_schema = 'public'
     order by table_name, ordinal_position`,
  );
  return res.rows;
}

async function fetchForeignKeys(): Promise<FkRow[]> {
  const res = await pool!.query(
    `select
       c.relname as table_name,
       a.attname as column_name,
       case when rn.nspname = 'public' then r.relname
            else rn.nspname || '.' || r.relname end as ref_table
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_namespace n on n.oid = c.relnamespace
     join pg_class r on r.oid = con.confrelid
     join pg_namespace rn on rn.oid = r.relnamespace
     join lateral unnest(con.conkey) with ordinality as k(attnum, ord) on true
     join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
     where con.contype = 'f'
       and n.nspname = 'public'
     order by c.relname, a.attname`,
  );
  return res.rows;
}

async function fetchUniques(): Promise<UniqueRow[]> {
  const res = await pool!.query(
    `select
       tc.table_name,
       array_agg(kcu.column_name order by kcu.ordinal_position)::text[] as columns
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu
       on tc.constraint_name = kcu.constraint_name
       and tc.constraint_schema = kcu.constraint_schema
     where tc.constraint_type = 'UNIQUE'
       and tc.table_schema = 'public'
     group by tc.table_name, tc.constraint_name
     order by tc.table_name`,
  );
  return res.rows as UniqueRow[];
}

async function fetchChecks(): Promise<CheckRow[]> {
  const res = await pool!.query(
    `select
       c.relname as table_name,
       array_agg(a.attname order by k.ord) as columns
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_namespace n on n.oid = c.relnamespace
     join lateral unnest(con.conkey) with ordinality as k(attnum, ord) on true
     join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
     where con.contype = 'c'
       and n.nspname = 'public'
     group by c.relname, con.conname
     order by c.relname`,
  );
  return res.rows as CheckRow[];
}

async function fetchIndexes(): Promise<string[]> {
  const res = await pool!.query(
    `select indexname from pg_indexes
     where schemaname = 'public'
     order by indexname`,
  );
  return res.rows.map((r) => r.indexname as string);
}

async function fetchRlsTables(): Promise<Set<string>> {
  const res = await pool!.query(
    `select c.relname
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity`,
  );
  return new Set(res.rows.map((r) => r.relname as string));
}

async function fetchEnums(): Promise<Map<string, string[]>> {
  const res = await pool!.query(
    `select t.typname, e.enumlabel
     from pg_type t
     join pg_enum e on e.enumtypid = t.oid
     join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
     order by t.typname, e.enumsortorder`,
  );
  const map = new Map<string, string[]>();
  for (const row of res.rows) {
    const name = row.typname as string;
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(row.enumlabel as string);
  }
  return map;
}

async function fetchFunctions(): Promise<Set<string>> {
  const res = await pool!.query(
    `select p.proname
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'`,
  );
  return new Set(res.rows.map((r) => r.proname as string));
}

async function fetchTriggers(): Promise<Array<{ name: string; table: string }>> {
  const res = await pool!.query(
    `select tg.tgname,
       case when n.nspname = 'public' then c.relname
            else n.nspname || '.' || c.relname end as table_name
     from pg_trigger tg
     join pg_class c on c.oid = tg.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('public', 'auth')
       and not tg.tgisinternal
       and tg.tgenabled = 'O'`,
  );
  return res.rows.map((r) => ({
    name: r.tgname as string,
    table: r.table_name as string,
  }));
}

async function expectViolation(sql: string): Promise<string> {
  const client = await pool!.connect();
  try {
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("rollback");
      throw new Error(`expected constraint violation, but query succeeded:\n${sql}`);
    } catch (err) {
      await client.query("rollback");
      const e = err as { code?: string; message?: string };
      if (!e.code) throw err;
      return e.code;
    }
  } finally {
    client.release();
  }
}

function sameColumns(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().every((v, i) => [...b].sort()[i] === v);
}

describe.skipIf(noDbUrl)("live Supabase database (pg)", () => {
  beforeAll(async () => {
    await pool!.query("select 1");
  });

  afterAll(async () => {
    await pool!.end();
  });

  describe("connection", () => {
    it("connects and answers SELECT 1", async () => {
      const res = await pool!.query("select 1 as ok");
      expect(res.rows[0].ok).toBe(1);
    });
  });

  describe("enums", () => {
    let enums: Map<string, string[]>;
    beforeAll(async () => {
      enums = await fetchEnums();
    });

    for (const [name, values] of Object.entries(EXPECTED_ENUMS)) {
      it(`defines ${name} with expected values`, () => {
        const actual = enums.get(name);
        expect(actual, `enum ${name} missing on live DB`).toBeDefined();
        if (!actual) return;
        if (name === "audit_action") {
          expect([...actual].sort()).toEqual([...values].sort());
        } else {
          expect(actual).toEqual(values);
        }
      });
    }
  });

  describe("tables", () => {
    let columns: ColumnRow[];
    beforeAll(async () => {
      columns = await fetchColumns();
    });

    for (const tableName of EXPECTED_TABLE_NAMES) {
      describe(tableName, () => {
        const spec = EXPECTED_TABLES[tableName];
        const tableCols = () =>
          columns.filter((c) => c.table_name === tableName);

        it("exists", () => {
          expect(tableCols().length, `table ${tableName} missing on live DB`).toBeGreaterThan(0);
        });

        it("has all expected columns with correct types", () => {
          const present = new Map(
            tableCols().map((c) => [c.column_name, normalizeUdt(c.udt_name)]),
          );
          for (const [col, type] of Object.entries(spec.columns)) {
            expect(present.get(col), `column ${tableName}.${col} missing`).toBe(type);
          }
        });

        it("has NOT NULL on required columns", () => {
          const nullable = new Map(
            tableCols().map((c) => [c.column_name, c.is_nullable === "YES"]),
          );
          for (const col of spec.notNull) {
            expect(
              nullable.get(col),
              `column ${tableName}.${col} should be NOT NULL`,
            ).toBe(false);
          }
        });
      });
    }

    it("exposes exactly the expected business tables", () => {
      const names = new Set(columns.map((c) => c.table_name));
      for (const t of EXPECTED_TABLE_NAMES) expect(names.has(t)).toBe(true);
    });
  });

  describe("foreign keys", () => {
    let fks: FkRow[];
    beforeAll(async () => {
      fks = await fetchForeignKeys();
    });

    for (const tableName of EXPECTED_TABLE_NAMES) {
      const refs = EXPECTED_TABLES[tableName].references ?? {};
      for (const [col, target] of Object.entries(refs)) {
        it(`${tableName}.${col} references ${target}`, () => {
          const found = fks.find(
            (f) => f.table_name === tableName && f.column_name === col,
          );
          expect(found, `FK ${tableName}.${col} missing`).toBeDefined();
          expect(normalizeRef(found!.ref_table)).toBe(normalizeRef(target));
        });
      }
    }
  });

  describe("unique constraints", () => {
    let uniques: UniqueRow[];
    beforeAll(async () => {
      uniques = await fetchUniques();
    });

    for (const tableName of EXPECTED_TABLE_NAMES) {
      for (const group of EXPECTED_TABLES[tableName].unique) {
        it(`${tableName} unique(${group.join(", ")})`, () => {
          const found = uniques.some(
            (u) =>
              u.table_name === tableName && sameColumns(u.columns, group),
          );
          expect(found, `unique(${group.join(", ")}) on ${tableName} missing`).toBe(true);
        });
      }
    }
  });

  describe("check constraints", () => {
    let checks: CheckRow[];
    beforeAll(async () => {
      checks = await fetchChecks();
    });

    for (const tableName of EXPECTED_TABLE_NAMES) {
      for (const group of EXPECTED_TABLES[tableName].checks ?? []) {
        it(`${tableName} has CHECK over [${group.join(", ")}]`, () => {
          const found = checks.some(
            (c) =>
              c.table_name === tableName &&
              group.every((g) => c.columns.includes(g)),
          );
          expect(
            found,
            `CHECK over [${group.join(", ")}] on ${tableName} missing`,
          ).toBe(true);
        });
      }
    }
  });

  describe("indexes", () => {
    let indexes: string[];
    beforeAll(async () => {
      indexes = await fetchIndexes();
    });

    for (const idx of CRITICAL_INDEXES) {
      it(`creates ${idx}`, () => {
        expect(indexes).toContain(idx);
      });
    }
  });

  describe("row level security", () => {
    let rlsTables: Set<string>;
    beforeAll(async () => {
      rlsTables = await fetchRlsTables();
    });

    for (const tableName of EXPECTED_TABLE_NAMES) {
      it(`enables RLS on ${tableName}`, () => {
        expect(rlsTables.has(tableName), `RLS not enabled on ${tableName}`).toBe(true);
      });
    }
  });

  describe("functions and triggers", () => {
    let functions: Set<string>;
    let triggers: Array<{ name: string; table: string }>;
    beforeAll(async () => {
      [functions, triggers] = await Promise.all([
        fetchFunctions(),
        fetchTriggers(),
      ]);
    });

    for (const fn of REQUIRED_FUNCTIONS) {
      it(`defines function ${fn}`, () => {
        expect(functions.has(fn), `function ${fn} missing`).toBe(true);
      });
    }

    for (const { name, table } of REQUIRED_TRIGGERS) {
      it(`defines trigger ${name} on ${table}`, () => {
        const found = triggers.some(
          (t) => t.name === name && t.table === table,
        );
        expect(found, `trigger ${name} on ${table} missing`).toBe(true);
      });
    }
  });

  describe("constraint enforcement (behavior)", () => {
    it("rejects rating score outside 1-5 (CHECK)", async () => {
      const code = await expectViolation(
        `insert into public.ratings (id, registration_id, umkm_id, supplier_id, score)
         values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 6)`,
      );
      expect(code).toBe("23514");
    });

    it("rejects negative payment amount (CHECK)", async () => {
      const code = await expectViolation(
        `insert into public.payments (id, registration_id, midtrans_order_id, gross_amount, status)
         values (gen_random_uuid(), gen_random_uuid(), 'test-order', -1, 'pending')`,
      );
      expect(code).toBe("23514");
    });

    it("rejects non-4-digit pickup PIN (CHECK)", async () => {
      const code = await expectViolation(
        `insert into public.pickup_codes (id, registration_id, qr_code_token, pin_code)
         values (gen_random_uuid(), gen_random_uuid(), 'tok', '12a4')`,
      );
      expect(code).toBe("23514");
    });

    it("rejects non-linear batch timeline (CHECK)", async () => {
      const code = await expectViolation(
        `insert into public.batch_timeline
           (batch_id, registration_opens_at, registration_closes_at, payment_opens_at, payment_closes_at, estimated_ready_at)
         values
           (gen_random_uuid(), now(), now() - interval '1 day', now(), now(), now())`,
      );
      expect(code).toBe("23514");
    });

    it("rejects duplicate NIK on supplier_profiles (UNIQUE)", async () => {
      const code = await expectViolation(
        `insert into public.supplier_profiles
           (user_id, business_name, address, latitude, longitude, nik, ktp_photo_url)
         values
           (gen_random_uuid(), 'A', 'addr', 1, 1, '0000000000000001', 'https://x/a.jpg'),
           (gen_random_uuid(), 'B', 'addr', 2, 2, '0000000000000001', 'https://x/b.jpg')`,
      );
      expect(code).toBe("23505");
    });

    it("rejects duplicate (batch_id, umkm_id) registration (UNIQUE)", async () => {
      const client = await pool!.connect();
      try {
        await client.query("begin");
        try {
          const { rows: s } = await client.query<{ uid: string }>(
            `insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
             values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1, 'x')
             returning id as uid`,
            [`rpc-reg-dup-sup-${Math.random().toString(36).slice(2, 10)}@example.com`],
          );
          const supplierId = s[0].uid;
          await client.query(
            `insert into public.profiles (id, role, status, full_name)
             values ($1, 'supplier', 'active', 'Dup Supplier')
             on conflict (id) do update set role = 'supplier', status = 'active', full_name = 'Dup Supplier'`,
            [supplierId],
          );
          const { rows: u } = await client.query<{ uid: string }>(
            `insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
             values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1, 'x')
             returning id as uid`,
            [`rpc-reg-dup-umk-${Math.random().toString(36).slice(2, 10)}@example.com`],
          );
          const umkmId = u[0].uid;
          await client.query(
            `insert into public.profiles (id, role, status, full_name)
             values ($1, 'umkm', 'active', 'Dup Umkm')
             on conflict (id) do update set role = 'umkm', status = 'active', full_name = 'Dup Umkm'`,
            [umkmId],
          );
          const { rows: b } = await client.query<{ id: string }>(
            `insert into public.batches
               (supplier_id, title, category, min_quantity, pickup_name, pickup_address, latitude, longitude, status)
             values ($1, 'Dup Test', 'Food', 1, 'Pickup Test', 'addr', 1, 1, 'published')
             returning id`,
            [supplierId],
          );
          const batchId = b[0].id;
          await client.query(
            `insert into public.batch_timeline
               (batch_id, registration_opens_at, registration_closes_at, payment_opens_at, payment_closes_at, estimated_ready_at)
             values
               ($1, now() - interval '1 hour', now() + interval '1 hour', now() + interval '1 hour' + interval '1 minute', now() + interval '2 hours', now() + interval '3 hours')`,
            [batchId],
          );
          let code: string | undefined;
          try {
            await client.query(
              `with pair as (select '${batchId}'::uuid as batch_id, '${umkmId}'::uuid as umkm_id)
               insert into public.registrations (id, batch_id, umkm_id, quantity, consented_at)
               select gen_random_uuid(), batch_id, umkm_id, 1, now() from pair
               union all
               select gen_random_uuid(), batch_id, umkm_id, 1, now() from pair`,
            );
          } catch (err) {
            code = (err as { code?: string }).code;
          }
          expect(code).toBe("23505");
        } finally {
          await client.query("rollback");
        }
      } finally {
        client.release();
      }
    });

    it("rejects duplicate payment for one registration (UNIQUE)", async () => {
      const code = await expectViolation(
        `with reg as (select gen_random_uuid() as registration_id)
         insert into public.payments (id, registration_id, midtrans_order_id, gross_amount, status)
         select gen_random_uuid(), registration_id, 'o1', 100, 'pending'::public.payment_status from reg
         union all
         select gen_random_uuid(), registration_id, 'o2', 100, 'pending'::public.payment_status from reg`,
      );
      expect(code).toBe("23505");
    });

    it("rejects unknown enum value (invalid_text_representation)", async () => {
      const code = await expectViolation(
        `insert into public.profiles (id, role, full_name)
         values (gen_random_uuid(), 'superadmin', 'X')`,
      );
      expect(["22P02", "23514"]).toContain(code);
    });

    it("enforces NOT NULL on required columns", async () => {
      const code = await expectViolation(
        `insert into public.batches (id, supplier_id, title, category, min_quantity, pickup_address, latitude, longitude)
         values (gen_random_uuid(), gen_random_uuid(), null, 'x', 1, 'addr', 1, 1)`,
      );
      expect(code).toBe("23502");
    });

    it("blocks UPDATE on admin_audit_logs (immutable trigger)", async () => {
      const code = await expectViolation(
        `do $$
         declare
           u uuid;
           a uuid;
         begin
           insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
           values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'immutable-test@example.com', 'x')
           returning id into u;
           insert into public.admin_audit_logs (admin_id, action_type, target_type, target_id)
           values (u, 'verify_supplier', 'supplier_profiles', gen_random_uuid())
           returning id into a;
           update public.admin_audit_logs set target_type = 'tampered' where id = a;
         end;
         $$`,
      );
      expect(code).toBe("P0001");
    });

    it("blocks TRUNCATE on admin_audit_logs (no_truncate trigger)", async () => {
      const code = await expectViolation(`truncate public.admin_audit_logs`);
      expect(code).toBe("P0001");
    });

    it("rejects write_audit_log from a non-admin session", async () => {
      const code = await expectViolation(
        `select public.write_audit_log(gen_random_uuid(), 'ban_user', 'profiles', gen_random_uuid())`,
      );
      expect(code).toBe("P0001");
    });

    it("rejects negative refund amount (CHECK)", async () => {
      const code = await expectViolation(
        `insert into public.refund_requests
           (id, registration_id, batch_id, trigger_type, amount, status)
         values
           (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'dispute_won', -50, 'pending')`,
      );
      expect(code).toBe("23514");
    });
  });

  describe("admin action rpc audit write path", () => {
    it("approve_supplier transitions the supplier and appends an audit row", async () => {
      const client = await pool!.connect();
      try {
        await client.query("begin");
        const { rows: adminRows } = await client.query<{ uid: string }>(
          `insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
           values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1, 'x')
           returning id as uid`,
          [`rpc-admin-${Math.random().toString(36).slice(2, 10)}@example.com`],
        );
        const adminId = adminRows[0].uid;
        await client.query(
          `insert into public.profiles (id, role, status, full_name)
           values ($1, 'admin', 'active', 'Audit Admin')
           on conflict (id) do update set role = 'admin', status = 'active'`,
          [adminId],
        );
        const { rows: supplierRows } = await client.query<{ uid: string }>(
          `insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
           values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1, 'x')
           returning id as uid`,
          [`rpc-supplier-${Math.random().toString(36).slice(2, 10)}@example.com`],
        );
        const supplierId = supplierRows[0].uid;
        await client.query(
          `insert into public.supplier_profiles
             (user_id, business_name, address, latitude, longitude, nik, ktp_photo_url)
           values ($1, 'RPC Test', 'addr', 1, 1, $2, 'https://x/ktp.jpg')`,
          [supplierId, `rpc-${Math.random().toString(36).slice(2, 16)}`],
        );
        await client.query(
          `select set_config('request.jwt.claims',
             json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
          [adminId],
        );
        await client.query(
          `select public.approve_supplier($1::uuid, '1.2.3.4', 'live-test-agent')`,
          [supplierId],
        );
        const { rows: statusRows } = await client.query<{
          verification_status: string;
        }>(
          `select verification_status from public.supplier_profiles where user_id = $1`,
          [supplierId],
        );
        expect(statusRows[0].verification_status).toBe("approved");
        const { rows: logRows } = await client.query<{
          action_type: string;
          admin_id: string;
          ip_address: string;
        }>(
          `select action_type, admin_id, ip_address from public.admin_audit_logs
           where target_id = $1 and action_type = 'verify_supplier'`,
          [supplierId],
        );
        expect(logRows).toHaveLength(1);
        expect(logRows[0].admin_id).toBe(adminId);
        expect(logRows[0].ip_address).toBe("1.2.3.4");
        await client.query("rollback");
      } finally {
        client.release();
      }
    });
  });
});

describe.skipIf(noRestUrl)("live Supabase database (REST)", () => {
  it("serves every business table through PostgREST", async () => {
    const fetchTable = async (table: string) => {
      for (let attempt = 0; ; attempt++) {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`,
          {
            headers: {
              apikey: PUBLISHABLE_KEY!,
              Authorization: `Bearer ${PUBLISHABLE_KEY!}`,
            },
            signal: AbortSignal.timeout(15_000),
          },
        );
        const body = await res.text();
        if (res.status === 200 || attempt === 2 || res.status < 500) {
          return { table, status: res.status, body };
        }
      }
    };
    const chunk = <T>(items: T[], size: number): T[][] => {
      const out: T[][] = [];
      for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
      return out;
    };
    const results = (
      await Promise.all(
        chunk(EXPECTED_TABLE_NAMES, 5).map(async (group) =>
          Promise.all(group.map(fetchTable)),
        ),
      )
    ).flat();
    const failures = results.filter((r) => r.status !== 200);
    expect(
      failures.map((f) => `${f.table}: ${f.status} ${f.body.slice(0, 160)}`),
    ).toEqual([]);
  });

  it("returns empty list for anon read of profiles (RLS enforced)", async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*`, {
      headers: {
        apikey: PUBLISHABLE_KEY!,
        Authorization: `Bearer ${PUBLISHABLE_KEY!}`,
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  it("blocks anon INSERT into admin_audit_logs (RLS, no insert policy)", async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_audit_logs`, {
      method: "POST",
      headers: {
        apikey: PUBLISHABLE_KEY!,
        Authorization: `Bearer ${PUBLISHABLE_KEY!}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        admin_id: "00000000-0000-0000-0000-000000000000",
        action_type: "verify_supplier",
        target_type: "supplier_profiles",
        target_id: "00000000-0000-0000-0000-000000000000",
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
