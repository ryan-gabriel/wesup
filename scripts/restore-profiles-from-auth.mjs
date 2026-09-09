// Reconstruct public.profiles from surviving auth.users after a public reset.
// History: the original public-seed snapshot was overwritten (empty regen),
// leaving only auth.users. This restores one profile row per auth user with
// schema defaults (role 'umkm', status 'active') and the account's metadata.
// Idempotent: uses on conflict (id) do nothing.
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
    const { rows: users } = await pool.query(
      "select id, email, raw_user_meta_data, created_at from auth.users order by email",
    );
    let inserted = 0;
    let skipped = 0;
    for (const u of users) {
      const meta = u.raw_user_meta_data ?? {};
      const fullName = meta.full_name ?? "";
      const phone = meta.phone ?? null;
      const ts = u.created_at ?? new Date();
      const { rowCount } = await pool.query(
        `insert into public.profiles (id, role, status, full_name, phone, created_at, updated_at, email)
         values ($1, 'umkm', 'active', $2, $3, $4, $4, $5)
         on conflict (id) do nothing`,
        [u.id, fullName, phone, ts, u.email],
      );
      if (rowCount === 1) inserted++;
      else skipped++;
    }
    const { rows: total } = await pool.query(
      "select count(*)::int as n from public.profiles",
    );
    console.log(
      `profiles reconstructed: ${inserted} inserted, ${skipped} skipped (already present). total = ${total[0].n}`,
    );
    return 0;
  } finally {
    await pool.end();
  }
}

process.exit(
  await main().catch((err) => {
    console.error(`restore-profiles failed: ${err.message}`);
    return 1;
  }),
);