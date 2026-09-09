import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

function loadEnv(path) {
  const txt = readFileSync(path, "utf8");
  const out = {};
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const { DATABASE_URL } = loadEnv(".env");
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required (from .env)");
  process.exit(1);
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function splitVersion(fname) {
  const m = fname.match(/^(\d+)_(.*)\.sql$/);
  if (!m) return [fname.replace(/\.sql$/, ""), ""];
  return [m[1], m[2]];
}

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("set search_path = public, extensions");

  console.log("== base role grants ==");
  const roles = (
    await client.query("select rolname from pg_roles")
  ).rows.map((r) => r.rolname);
  const clientRoles = ["postgres", "anon", "authenticated", "service_role"];
  if (roles.includes("supabase_auth_admin")) clientRoles.push("supabase_auth_admin");
  if (roles.includes("supabase_storage_admin")) clientRoles.push("supabase_storage_admin");

  console.log("-- drop old lineage + recreate public");
  await client.query("drop schema if exists supabase_migrations cascade");
  await client.query("drop schema public cascade");
  await client.query("create schema public");
  await client.query("grant usage on schema public to public");
  await client.query("grant all on schema public to postgres, service_role");

  const grants = [];
  for (const role of clientRoles) {
    grants.push(`grant usage on schema public to ${role}`);
    grants.push(`grant all on all tables in schema public to ${role}`);
    grants.push(`grant all on all routines in schema public to ${role}`);
    grants.push(`grant all on all sequences in schema public to ${role}`);
    grants.push(`grant all on all functions in schema public to ${role}`);
    grants.push(
      `alter default privileges in schema public grant all on tables to ${role}`,
    );
    grants.push(
      `alter default privileges in schema public grant all on routines to ${role}`,
    );
    grants.push(
      `alter default privileges in schema public grant all on sequences to ${role}`,
    );
    grants.push(
      `alter default privileges in schema public grant all on functions to ${role}`,
    );
  }
  for (const g of grants) await client.query(g);
  console.log(`-- granted ${clientRoles.join(", ")}`);

  console.log("== replay migrations ==");
  await client.query(
    "create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text)",
  );

  const files = migrationFiles();
  for (const file of files) {
    let sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const [version, name] = splitVersion(file);
    console.log(`-- ${file}`);
    // Cloud-only limitation: storage.objects is owned by supabase_storage_admin,
    // which the postgres connection cannot SET ROLE to, so ALTER/CREATE POLICY
    // on storage.objects is not writable here. Skip that DDL (deny-by-default
    // remains; public.* helper functions + bucket rows still apply via their
    // `public.`/`storage.buckets` targets). No schema-contract test depends on
    // storage policies. NOTE: this deviation is recorded in the TDD evidence doc.
    const stripped = sql
      .replace(/alter\s+table\s+storage\.objects\s+enable\s+row\s+level\s+security\s*;/gi, "-- skipped: storage.objects RLS enable (owner supabase_storage_admin)")
      .replace(
        /create\s+policy\s+"[^"]+"\s+on\s+storage\.objects\s*[\s\S]*?\);/gi,
        "-- skipped: storage.objects policy (owner supabase_storage_admin)",
      );
    if (stripped !== sql) {
      const skips = (sql.match(/on\s+storage\.objects/gi) || []).length;
      console.log(`--   [storage DDL skipped: ${skips} statement(s) - owner-only]`);
      sql = stripped;
    }
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)",
        [version, [], name],
      );
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      console.error(`FAILED on ${file}: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }
  console.log(`-- applied ${files.length} migrations`);

  console.log("== restore seed ==");
  const seedFile = process.argv[2];
  if (!seedFile || !seedFile.endsWith(".sql")) {
    console.error("usage: node scripts/replay-public-schema.mjs <seed.sql>");
    await client.end();
    process.exit(1);
  }
  const seed = readFileSync(seedFile, "utf8");

  const expected = {};
  for (const m of seed.matchAll(/^-- table: public\.(\w+) \((\d+) rows\)/gm)) {
    expected[m[1]] = Number(m[2]);
  }

  await client.query("begin");
  await client.query(seed);
  await client.query("commit");

  console.log("== assert row counts ==");
  const tables = Object.keys(expected);
  let ok = true;
  for (const t of tables) {
    const r = await client.query(
      `select count(*)::int as n from public."${t}"`,
    );
    const actual = r.rows[0].n;
    const match = actual === expected[t];
    if (!match) ok = false;
    console.log(`  ${match ? "OK " : "MIS"} ${t}: ${actual} (expected ${expected[t]})`);
  }

  await client.end();
  if (!ok) {
    console.error("row-count mismatch after seed restore");
    process.exit(1);
  }
  console.log("ALL COUNTS MATCH");
}

main().catch((e) => {
  console.error("ERR:", e.code || "", e.message);
  process.exit(1);
});