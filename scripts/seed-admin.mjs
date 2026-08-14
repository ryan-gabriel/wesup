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
  const args = process.argv.slice(2);
  const remove = args.includes("--remove");
  const email = args.find((arg) => !arg.startsWith("-"));
  if (!email) {
    console.log("Usage: node scripts/seed-admin.mjs <email> [--remove]");
    return 1;
  }
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
    const { rows } = await pool.query(
      "select id from auth.users where email = $1",
      [email],
    );
    if (rows.length === 0) {
      console.error(
        `No auth user found for email "${email}". Have them sign up first, then re-run.`,
      );
      return 1;
    }
    const userId = rows[0].id;
    await pool.query(
      `insert into public.profiles (id, full_name, role, status)
       values ($1, '', 'admin', 'active')
       on conflict (id) do nothing`,
      [userId],
    );
    await pool.query(
      remove
        ? "update public.profiles set role = 'umkm' where id = $1"
        : "update public.profiles set role = 'admin', status = 'active' where id = $1",
      [userId],
    );
    if (remove) {
      console.log(`Admin role removed from ${email} (${userId}). Role is now 'umkm'.`);
    } else {
      console.log(`Admin role granted to ${email} (${userId}).`);
    }
    return 0;
  } finally {
    await pool.end();
  }
}

process.exit(
  await main().catch((err) => {
    console.error(`seed-admin failed: ${err.message}`);
    return 1;
  }),
);
