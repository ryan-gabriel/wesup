import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL) {
  const envPath = resolve(ROOT, ".env");
  if (existsSync(envPath)) {
    for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const idx = raw.indexOf("=");
      if (idx <= 0) continue;
      const key = raw.slice(0, idx).trim();
      if (!key || process.env[key] !== undefined) continue;
      let value = raw.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

const DEFAULT_PASSWORD = "12345678";

const DEMO_USERS = [
  {
    email: "demo.umkm@wesup.id",
    fullName: "Demo UMKM",
    role: "umkm",
  },
  {
    email: "demo.supplier@wesup.id",
    fullName: "Demo Supplier",
    role: "supplier",
  },
];

const AUTH_TOKEN_EMPTY_FIELDS =
  "confirmation_token = '', recovery_token = '', phone_change_token = '', " +
  "email_change_token_new = '', email_change = ''";

async function ensureAuthUser(pool, user, password) {
  const existing = await pool.query(
    "select id from auth.users where email = $1",
    [user.email],
  );
  let id;
  if (existing.rows.length > 0) {
    id = existing.rows[0].id;
    await pool.query(
      `update auth.users set
         encrypted_password = crypt($2, gen_salt('bf', 10)),
         email_confirmed_at = now(),
         last_sign_in_at = now(),
         raw_user_meta_data = jsonb_build_object('full_name', $3::text, 'role', $4::text),
         raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
         ${AUTH_TOKEN_EMPTY_FIELDS},
         updated_at = now()
       where id = $1`,
      [id, password, user.fullName, user.role],
    );
  } else {
    const { rows } = await pool.query(
      `insert into auth.users (
         id, instance_id, aud, role, email, encrypted_password,
         email_confirmed_at, last_sign_in_at,
         confirmation_token, recovery_token, phone_change_token,
         email_change_token_new, email_change,
         raw_app_meta_data, raw_user_meta_data,
         is_sso_user, is_anonymous, created_at, updated_at
       )
       values (
         gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
         'authenticated', 'authenticated', $1,
         crypt($2, gen_salt('bf', 10)),
         now(), now(),
         '', '', '', '', '',
         '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('full_name', $3::text, 'role', $4::text),
         false, false, now(), now()
       )
       returning id`,
      [user.email, password, user.fullName, user.role],
    );
    id = rows[0].id;
  }

  const identity = await pool.query(
    "select id from auth.identities where user_id = $1 and provider = 'email'",
    [id],
  );
  if (identity.rows.length > 0) {
    await pool.query(
      `update auth.identities set
         identity_data = jsonb_build_object(
           'sub', user_id::text, 'email', $2::text, 'full_name', $3::text,
           'email_verified', false, 'phone_verified', false),
         provider_id = user_id::text,
         updated_at = now()
       where id = $1`,
      [identity.rows[0].id, user.email, user.fullName],
    );
  } else {
    await pool.query(
      `insert into auth.identities (
         id, user_id, identity_data, provider, provider_id,
         last_sign_in_at, created_at, updated_at
       )
       values (
         $1,
         $1,
         jsonb_build_object(
           'sub', $4::text, 'email', $2::text, 'full_name', $3::text,
           'email_verified', false, 'phone_verified', false),
         'email', $4::text,
         now(), now(), now()
       )`,
      [id, user.email, user.fullName, String(id)],
    );
  }

  await pool.query(
    `insert into public.profiles (id, full_name, phone, role, status)
     values ($1, $2, null, $3, 'active')
     on conflict (id) do update set
       full_name = $2,
       role = $3,
       status = 'active',
       updated_at = now()`,
    [id, user.fullName, user.role],
  );
  return { id, email: user.email, role: user.role };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL not set. Add it to .env or export it.");
    return 1;
  }
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const results = [];
      for (const user of DEMO_USERS) {
        results.push(await ensureAuthUser(client, user, DEFAULT_PASSWORD));
      }
      await client.query("commit");
      console.log("Demo users are ready (password: " + DEFAULT_PASSWORD + "):");
      for (const r of results) {
        console.log(`  - ${r.email} (${r.role}, ${r.id})`);
      }
      console.log("Login at /login and pick the matching role.");
      return 0;
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

process.exit(
  await main().catch((err) => {
    console.error(`seed-demo-users failed: ${err.message}`);
    return 1;
  }),
);