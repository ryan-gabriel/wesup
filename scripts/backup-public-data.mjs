import { readFileSync } from "node:fs";
import { Client } from "pg";

const { DATABASE_URL } = loadEnv(".env");
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required (from .env)");
  process.exit(1);
}

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

function esc(value) {
  return value.replace(/'/g, "''");
}

function literal(v, type) {
  if (v === null || v === undefined) return "NULL";
  const t = String(type);
  if (t === "boolean") return v ? "TRUE" : "FALSE";
  if (t === "jsonb" || t === "json")
    return `'${esc(JSON.stringify(v))}'::${t}`;
  if (
    t === "timestamp with time zone" ||
    t === "timestamp without time zone" ||
    t === "time with time zone" ||
    t === "time without time zone" ||
    t === "date"
  ) {
    const iso =
      v instanceof Date ? v.toISOString() : new Date(v).toISOString();
    return `'${iso}'::timestamptz`;
  }
  if (t === "bytea") return `'\\x${Buffer.from(v).toString("hex")}'::bytea`;
  // pg returns integer/bigint/numeric/float as JS number or string.
  if (
    t.startsWith("int") ||
    t === "numeric" ||
    t === "float8" ||
    t === "float4" ||
    t === "smallint" ||
    t === "bigint" ||
    t === "real" ||
    t === "double precision"
  ) {
    return String(v);
  }
  if (Array.isArray(v)) {
    const parts = v.map((el) => {
      if (el === null) return "NULL";
      if (typeof el === "number") return String(el);
      return `'${esc(String(el))}'`;
    });
    return `ARRAY[${parts.join(",")}]`;
  }
  return `'${esc(String(v))}'`;
}

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const tables = (
    await client.query(
      `select table_name
         from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name`,
    )
  ).rows.map((r) => r.table_name);

  const deps = new Map(tables.map((t) => [t, new Set()]));
  const fks = await client.query(
    `select conrelid::regclass::text as tbl,
            confrelid::regclass::text as ftbl
       from pg_constraint
      where contype = 'f'
        and connamespace = 'public'::regnamespace`,
  );
  for (const { tbl, ftbl } of fks.rows) {
    const cleaned = tbl.replace(/^["']?public\./i, "").replace(/^["']|["']$/g, "");
    const fcleaned = ftbl.replace(/^public\./i, "");
    if (deps.has(cleaned) && deps.has(fcleaned) && cleaned !== fcleaned) {
      deps.get(cleaned).add(fcleaned);
    }
  }

  const order = [];
  const deg = new Map();
  const remaining = new Set(tables);
  while (remaining.size) {
    for (const t of remaining) {
      let d = 0;
      for (const dep of deps.get(t)) if (remaining.has(dep)) d++;
      deg.set(t, d);
    }
    const ready = [...remaining].filter((t) => deg.get(t) === 0);
    if (!ready.length) {
      order.push(...[...remaining]);
      break;
    }
    for (const t of ready) {
      order.push(t);
      remaining.delete(t);
    }
  }

  const counts = {};
  for (const table of order) {
    const cols = (
      await client.query(
        `select column_name, data_type
           from information_schema.columns
          where table_schema = 'public' and table_name = $1
          order by ordinal_position`,
        [table],
      )
    ).rows;
    if (!cols.length) continue;
    const colNames = cols.map((c) => c.column_name);
    const hasId = colNames.includes("id");
    const safeName = table.replace(/"/g, '""');
    const orderBy = hasId ? "order by id" : "";
    const res = await client.query(
      `select * from public."${safeName}" ${orderBy}`,
    );
    counts[table] = res.rows.length;
    if (!res.rows.length) continue;

    const typeBy = new Map(cols.map((c) => [c.column_name, c.data_type]));
    const header = cols.map((c) => `"${c.column_name.replace(/"/g, '""')}"`).join(", ");
    const rows = res.rows.map((row) =>
      cols.map((c) => literal(row[c.column_name], typeBy.get(c.column_name))).join(", "),
    );
    console.log(`-- table: public.${table} (${res.rows.length} rows)`);
    console.log(`insert into public."${safeName}" (${header}) values`);
    for (let i = 0; i < rows.length; i++) {
      const terminator = i === rows.length - 1 ? ";" : ",";
      console.log(`(${rows[i]})${terminator}`);
    }
    console.log("");
  }

  console.log("-- row counts");
  for (const table of order) {
    if (counts[table] !== undefined) console.log(`-- ${table}: ${counts[table]}`);
  }

  await client.end();
}

main().catch((e) => {
  console.error("ERR:", e.code || "", e.message);
  process.exit(1);
});