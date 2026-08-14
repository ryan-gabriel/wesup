import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "pgsql-ast-parser";
import {
  ColumnDef,
  EXPECTED_ENUMS,
  EXPECTED_TABLES,
  CRITICAL_INDEXES,
  REQUIRED_FUNCTIONS,
  REQUIRED_TRIGGERS,
} from "../helpers/schema-contract";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

interface ParsedSchema {
  tables: Map<
    string,
    {
      columns: Map<string, ColumnDef>;
      checks: unknown[];
      tableUniques: string[][];
    }
  >;
  enums: Map<string, string[]>;
  indexes: Map<string, string[]>;
}

function stripUnsupported(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION[\s\S]*?\$\$\s*;/gi, "")
    .replace(/CREATE\s+TRIGGER[^;]+;/gi, "")
    .replace(/CREATE\s+POLICY[^;]+;/gi, "")
    .replace(/DROP\s+POLICY[^;]+;/gi, "")
    .replace(/GRANT\s+[^;]+;/gi, "")
    .replace(/REVOKE\s+[^;]+;/gi, "")
    .replace(/ALTER\s+TABLE[^;]*ENABLE\s+ROW\s+LEVEL\s+SECURITY[^;]*;/gi, "")
    .replace(/ALTER\s+TABLE[^;]*FORCE\s+ROW\s+LEVEL\s+SECURITY[^;]*;/gi, "");
}

function collectRefs(expr: unknown, acc: Set<string>): void {
  if (!expr || typeof expr !== "object") return;
  const e = expr as Record<string, unknown>;
  if (e.type === "ref" && typeof e.name === "string") acc.add(e.name);
  for (const v of Object.values(e)) {
    if (Array.isArray(v)) v.forEach((x) => collectRefs(x, acc));
    else collectRefs(v, acc);
  }
}

function loadSchema(): ParsedSchema {
  const files = listMigrationFiles();
  const schema: ParsedSchema = {
    tables: new Map(),
    enums: new Map(),
    indexes: new Map(),
  };
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const clean = stripUnsupported(sql);
    if (clean.trim().length === 0) continue;
    const ast = parse(clean);
    for (const stmt of ast) {
      if (stmt.type === "create table") {
        const name = stmt.name.name;
        const table = schema.tables.get(name) ?? {
          columns: new Map<string, ColumnDef>(),
          checks: [] as unknown[],
          tableUniques: [] as string[][],
        };
        for (const rawCol of stmt.columns) {
          if (rawCol.kind !== "column") continue;
          const col = rawCol;
          const dataType = col.dataType as
            | { name: string; kind?: string; arrayOf?: { name: string } }
            | undefined;
          const typeName =
            dataType?.kind === "array" ? "array" : (dataType?.name ?? "unknown");
          const constraints = (col.constraints ?? []) as Array<{
            type: string;
            foreignTable?: { schema?: string; name: string };
            expr?: unknown;
            columns?: Array<{ name: string }>;
          }>;
          const ref = constraints.find((c) => c.type === "reference")
            ?.foreignTable;
          table.columns.set(col.name.name, {
            type: typeName,
            notNull: constraints.some(
              (c) => c.type === "not null" || c.type === "primary key",
            ),
            references: ref
              ? ref.schema === "public"
                ? ref.name
                : `${ref.schema}.${ref.name}`
              : undefined,
            unique: constraints.some((c) => c.type === "unique"),
          });
          const check = constraints.find((c) => c.type === "check");
          if (check) table.checks.push(check);
        }
        const tableConstraints = (stmt.constraints ?? []) as Array<{
          type: string;
          columns?: Array<{ name: string }>;
          expr?: unknown;
        }>;
        const check = tableConstraints.find((c) => c.type === "check");
        if (check) table.checks.push(check);
        for (const c of tableConstraints) {
          if (c.type === "unique" && c.columns) {
            table.tableUniques.push(c.columns.map((col) => col.name));
          }
        }
        schema.tables.set(name, table);
      }
      if (stmt.type === "create enum") {
        schema.enums.set(stmt.name.name, stmt.values.map((v) => v.value));
      }
      if (stmt.type === "create index" && stmt.indexName && stmt.expressions) {
        schema.indexes.set(
          stmt.indexName.name,
          stmt.expressions.map(
            (e) => (e.expression as { name?: string }).name ?? "expr",
          ),
        );
      }
    }
  }
  return schema;
}

function listMigrationFiles(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function extractPolicies(sql: string): Array<{
  name: string;
  table: string;
  action: string;
}> {
  const dropped = new Set<string>();
  const dropRe = /DROP\s+POLICY\s+IF\s+EXISTS\s+"?([a-zA-Z0-9_]+)"?\s+ON\s+public\.([a-zA-Z0-9_]+)/gi;
  for (const m of sql.matchAll(dropRe)) {
    dropped.add(`${m[1]}:${m[2]}`);
  }
  const policies: Array<{ name: string; table: string; action: string }> = [];
  const blockRe = /CREATE\s+POLICY\s+"?([a-zA-Z0-9_]+)"?\s+ON\s+public\.([a-zA-Z0-9_]+)\s+FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)/gi;
  for (const m of sql.matchAll(blockRe)) {
    if (dropped.has(`${m[1]}:${m[2]}`)) continue;
    policies.push({ name: m[1], table: m[2], action: m[3].toUpperCase() });
  }
  return policies;
}

function extractRlsEnabled(sql: string): Set<string> {
  const re = /ALTER\s+TABLE\s+public\.([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  return new Set([...sql.matchAll(re)].map((m) => m[1]));
}

describe("migration files", () => {
  let files: string[];
  beforeAll(() => {
    files = listMigrationFiles();
  });

  it("exist and follow Supabase timestamp naming", () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
    for (const f of files) {
      expect(f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    }
  });

  it("are strictly ordered and non-duplicate", () => {
    const timestamps = files.map((f) => Number(f.slice(0, 14)));
    expect(new Set(timestamps).size).toBe(timestamps.length);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
    }
  });

  it("parse as valid PostgreSQL", () => {
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const clean = stripUnsupported(sql);
      if (clean.trim().length === 0) continue;
      expect(() => parse(clean), `syntax error in ${file}`).not.toThrow();
    }
  });

  it("contain no destructive statements", () => {
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      expect(sql).not.toMatch(/DROP\s+TABLE/i);
      expect(sql).not.toMatch(/TRUNCATE\s+TABLE/i);
    }
  });
});

describe("enums", () => {
  let schema: ParsedSchema;
  beforeAll(() => {
    schema = loadSchema();
  });

  for (const [enumName, values] of Object.entries(EXPECTED_ENUMS)) {
    it(`defines ${enumName} with expected values`, () => {
      expect(schema.enums.get(enumName)).toEqual(values);
    });
  }
});

describe("tables", () => {
  let schema: ParsedSchema;
  beforeAll(() => {
    schema = loadSchema();
  });

  for (const [tableName, spec] of Object.entries(EXPECTED_TABLES)) {
    describe(tableName, () => {
      let table: ParsedSchema["tables"] extends Map<string, infer T> ? T : never;
      beforeAll(() => {
        table = schema.tables.get(tableName) as typeof table;
        expect(table, `table ${tableName} missing`).toBeDefined();
      });

      it("has all expected columns with correct types", () => {
        for (const [col, type] of Object.entries(spec.columns)) {
          expect(table.columns.get(col)?.type, `column ${tableName}.${col}`).toBe(
            type,
          );
        }
      });

      it("has NOT NULL on required columns", () => {
        for (const col of spec.notNull) {
          expect(
            table.columns.get(col)?.notNull,
            `column ${tableName}.${col} should be NOT NULL`,
          ).toBe(true);
        }
      });

      it("has expected foreign key references", () => {
        for (const [col, target] of Object.entries(spec.references ?? {})) {
          expect(
            table.columns.get(col)?.references,
            `column ${tableName}.${col} should reference ${target}`,
          ).toBe(target);
        }
      });

      it("has expected unique constraints", () => {
        const uniqueSets = findUniqueConstraints(table);
        for (const group of spec.unique) {
          expect(
            uniqueSets.some((u) => sameColumns(u, group)),
            `unique(${group.join(", ")}) on ${tableName} missing`,
          ).toBe(true);
        }
      });

      it("has CHECK constraints covering expected columns", () => {
        for (const expectedCols of spec.checks ?? []) {
          const found = table.checks.some((check) => {
            const refs = new Set<string>();
            collectRefs(check, refs);
            return expectedCols.every((c) => refs.has(c));
          });
          expect(
            found,
            `CHECK over [${expectedCols.join(", ")}] on ${tableName} missing`,
          ).toBe(true);
        }
      });
    });
  }
});

function findUniqueConstraints(
  table: {
    columns: Map<string, ColumnDef>;
    checks: unknown[];
    tableUniques: string[][];
  },
): string[][] {
  const result: string[][] = [];
  for (const [name, col] of table.columns.entries()) {
    if (col.unique) result.push([name]);
  }
  return result.concat(table.tableUniques);
}

function sameColumns(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v));
}

describe("indexes", () => {
  let schema: ParsedSchema;
  beforeAll(() => {
    schema = loadSchema();
  });

  for (const idx of CRITICAL_INDEXES) {
    it(`creates ${idx}`, () => {
      expect(schema.indexes.has(idx)).toBe(true);
    });
  }
});

describe("row level security", () => {
  let allSql: string;
  let rlsEnabled: Set<string>;
  let policies: Array<{ name: string; table: string; action: string }>;
  beforeAll(() => {
    allSql = listMigrationFiles()
      .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
      .join("\n");
    rlsEnabled = extractRlsEnabled(allSql);
    policies = extractPolicies(allSql);
  });

  it("enables RLS on every business table", () => {
    for (const table of Object.keys(EXPECTED_TABLES)) {
      expect(rlsEnabled.has(table), `RLS not enabled on ${table}`).toBe(true);
    }
  });

  it("defines at least one policy per table", () => {
    const byTable = new Map<string, number>();
    for (const p of policies) byTable.set(p.table, (byTable.get(p.table) ?? 0) + 1);
    for (const table of Object.keys(EXPECTED_TABLES)) {
      expect(byTable.get(table) ?? 0, `no policies on ${table}`).toBeGreaterThan(0);
    }
  });

  it("keeps admin_audit_logs client-side read-only (no INSERT/UPDATE/DELETE policies)", () => {
    const auditPolicies = policies.filter((p) => p.table === "admin_audit_logs");
    expect(auditPolicies.length).toBeGreaterThan(0);
    for (const p of auditPolicies) {
      expect(p.action).toBe("SELECT");
    }
  });

  it("guards admin_audit_logs against TRUNCATE", () => {
    expect(allSql).toMatch(
      /create\s+trigger\s+admin_audit_logs_no_truncate\b[^;]*\bbefore\s+truncate\s+on\s+(?:public\.)?admin_audit_logs/i,
    );
  });

  it("defines the server-side audit writer", () => {
    expect(allSql).toMatch(
      /create\s+(?:or\s+replace\s+)?function\s+public\.write_audit_log/i,
    );
    expect(allSql).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.write_audit_log\b[^;]*\bfrom\s+public,\s*anon,\s*authenticated/i,
    );
  });

  it("grants UMKM read access to visible batches only via policies", () => {
    const batchPolicies = policies.filter((p) => p.table === "batches");
    expect(batchPolicies.some((p) => p.action === "SELECT")).toBe(true);
  });
});

describe("functions and triggers", () => {
  let allSql: string;
  beforeAll(() => {
    allSql = listMigrationFiles()
      .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
      .join("\n");
  });

  for (const fn of REQUIRED_FUNCTIONS) {
    it(`defines function ${fn}`, () => {
      expect(allSql).toMatch(
        new RegExp(
          `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fn}\\b`,
          "i",
        ),
      );
    });
  }

  for (const { name, table } of REQUIRED_TRIGGERS) {
    it(`defines trigger ${name} on ${table}`, () => {
      expect(allSql).toMatch(
        new RegExp(
          `CREATE\\s+TRIGGER\\s+${name}\\b[\\s\\S]*?\\bon\\s+(?:public\\.)?${table}\\b`,
          "i",
        ),
      );
    });
  }
});

describe("business rule constraints", () => {
  let schema: ParsedSchema;
  beforeAll(() => {
    schema = loadSchema();
  });

  it("enforces linear timeline ordering on batch_timeline", () => {
    const table = schema.tables.get("batch_timeline");
    expect(table).toBeDefined();
    const timelineOk = table!.checks.some((check) => {
      const refs = new Set<string>();
      collectRefs(check, refs);
      return (
        refs.has("registration_opens_at") &&
        refs.has("registration_closes_at") &&
        refs.has("payment_opens_at") &&
        refs.has("payment_closes_at") &&
        refs.has("estimated_ready_at")
      );
    });
    expect(timelineOk).toBe(true);
  });

  it("enforces rating range 1-5 on ratings.score", () => {
    const table = schema.tables.get("ratings");
    expect(table).toBeDefined();
    const ok = table!.checks.some((check) => {
      const refs = new Set<string>();
      collectRefs(check, refs);
      return refs.has("score");
    });
    expect(ok).toBe(true);
  });

  it("enforces positive amounts on money columns", () => {
    for (const tableName of ["payments", "escrow_holds", "refund_requests"]) {
      const table = schema.tables.get(tableName);
      const refs = new Set<string>();
      table!.checks.forEach((c) => collectRefs(c, refs));
      const amountCols = tableName === "payments" ? ["gross_amount"] : ["amount"];
      for (const c of amountCols) expect(refs.has(c)).toBe(true);
    }
  });
});
