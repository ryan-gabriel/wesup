import { Pool } from "pg";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/apply-migration.mjs <migration.sql>");
  process.exit(1);
}

function hasSql(stmt) {
  return (
    stmt
      .split("\n")
      .filter((line) => !/^\s*--/.test(line))
      .join("\n")
      .trim().length > 0
  );
}

function splitStatements(sql) {
  const stmts = [];
  let current = "";
  let inQuote = false;
  let dollarTag = null;
  let i = 0;
  while (i < sql.length) {
    // Consume line comments atomically so ';' / "'" inside prose never
    // affect statement splitting or quote state.
    if (dollarTag === null && !inQuote && sql.startsWith("--", i)) {
      const nl = sql.indexOf("\n", i);
      const end = nl === -1 ? sql.length : nl + 1;
      current += sql.slice(i, end);
      i = end;
      continue;
    }

    const ch = sql[i];

    // Inside a dollar-quoted body: verbatim until the closing tag.
    if (dollarTag !== null) {
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
      } else {
        current += ch;
        i++;
      }
      continue;
    }

    // Dollar-quote opening ($$ or $tag$).
    if (!inQuote && ch === "$") {
      const m = /^\$[a-zA-Z0-9_]*\$/.exec(sql.slice(i));
      if (m) {
        dollarTag = m[0];
        current += m[0];
        i += m[0].length;
        continue;
      }
    }

    if (ch === "'") inQuote = !inQuote;

    current += ch;
    i++;

    if (ch === ";" && !inQuote && dollarTag === null) {
      const trimmed = current.trim();
      if (hasSql(trimmed)) stmts.push(trimmed);
      current = "";
    }
  }
  const tail = current.trim();
  if (hasSql(tail)) stmts.push(tail);
  return stmts;
}

const TOLERATED = [
  /already exists/i,
  /duplicate key value violates unique constraint "pg_type_typname_nsp_index"/i,
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  const statements = splitStatements(readFileSync(file, "utf8"));
  let applied = 0;
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      applied++;
      console.log("ok:", stmt.split("\n")[0].slice(0, 72));
    } catch (err) {
      if (TOLERATED.some((re) => re.test(err.message))) {
        console.log("skip:", err.message.slice(0, 72));
      } else {
        throw err;
      }
    }
  }
  console.log(`done — ${applied}/${statements.length} applied`);
} finally {
  await pool.end();
}
