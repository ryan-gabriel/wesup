import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function listMigrationFiles(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function readAllSql(): string {
  return listMigrationFiles()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

function functionBody(sql: string, name: string): string {
  const re = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}[\\s\\S]*?\\$\\$;`,
    "ig",
  );
  const matches = [...sql.matchAll(re)];
  return matches.length ? matches[matches.length - 1][0] : "";
}

describe("registration integrity Gatekeeper (DB boundary)", () => {
  let allSql: string;
  let body: string;

  beforeAll(() => {
    allSql = readAllSql();
    body = functionBody(allSql, "prevent_registration_outside_window");
  });

  it("defines the trigger function as security definer with an empty search_path", () => {
    expect(body).toMatch(/create\s+(?:or\s+replace\s+)?function\s+public\.prevent_registration_outside_window/i);
    expect(body).toMatch(/security\s+definer/i);
    expect(body).toMatch(/set\s+search_path\s*=\s*''/i);
  });

  it("reads batch status and timeline from fully qualified tables", () => {
    expect(body).toMatch(/from\s+public\.batches/i);
    expect(body).toMatch(/public\.batch_timeline/i);
  });

  it("rejects inserts unless the batch is published", () => {
    expect(body).toMatch(/v_status\s*<>\s*'published'/i);
  });

  it("rejects inserts outside the absolute registration window", () => {
    expect(body).toMatch(/now\(\)\s*<\s*v_opens_at|now\(\)\s*>=\s*v_closes_at/i);
  });

  it("raises (aborts the insert) on any gate failure", () => {
    expect(body).toMatch(/raise\s+exception/i);
  });

  it("wires the function as a BEFORE INSERT trigger on registrations", () => {
    expect(allSql).toMatch(
      /create\s+trigger\s+prevent_registration_outside_window\b[\s\S]*?\bbefore\s+insert\s+on\s+(?:public\.)?registrations/i,
    );
  });

  it("does not introduce a cron or scheduled job (Lazy Evaluation)", () => {
    expect(allSql).not.toMatch(/pg_cron/i);
    expect(allSql).not.toMatch(/create\s+extension\s+pg_cron/i);
  });
});