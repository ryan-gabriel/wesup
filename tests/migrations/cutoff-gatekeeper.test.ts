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

function lastFunction(sql: string, name: string): string {
  const re = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}[\\s\\S]*?\\$\\$;`,
    "ig",
  );
  const matches = [...sql.matchAll(re)];
  return matches.length ? matches[matches.length - 1][0] : "";
}

describe("cut_off_batch (volume-limiting Gatekeeper)", () => {
  let allSql: string;
  let body: string;

  beforeAll(() => {
    allSql = readAllSql();
    body = lastFunction(allSql, "cut_off_batch");
  });

  it("is defined and security definer", () => {
    expect(body).toMatch(/security\s+definer/i);
    expect(body).toMatch(/create\s+or\s+replace\s+function\s+public\.cut_off_batch/i);
  });

  it("requires a signed-in caller", () => {
    expect(body).toMatch(/auth\.uid\(\) is null/i);
  });

  it("authorizes only an admin or the owning supplier", () => {
    expect(body).toMatch(/public\.is_admin\(\)/i);
    expect(body).toMatch(/v_supplier_id\s*<>\s*auth\.uid\(\)/i);
  });

  it("is idempotent: only closes batches still published", () => {
    expect(body).toMatch(/where\s+id\s*=\s*p_batch_id/i);
    expect(body).toMatch(/status\s*=\s*'published'/i);
  });

  it("reconciles volume from registrations and mirrors the counter", () => {
    expect(body).toMatch(/sum\(r\.quantity\)/i);
    expect(body).toMatch(/registration_counters/i);
    expect(body).toMatch(/on\s+conflict\s*\(\s*batch_id\s*\)/i);
  });

  it("falls back to Tier 1 (base price) when no higher tier threshold is met", () => {
    expect(body).toMatch(/tier_number\s*=\s*1/i);
  });

  it("locks final_amount = price_per_unit * quantity onto live registrations", () => {
    expect(body).toMatch(/locked_tier_number/i);
    expect(body).toMatch(/locked_price_per_unit/i);
    expect(body).toMatch(
      /final_amount\s*=\s*round\(\s*least\(\s*v_tier\.price_per_unit\s*\*\s*quantity\s*,\s*9999999999\.\d+\s*\)\s*,\s*2\s*\)/i,
    );
  });

  it("closes the batch and appends an audit record", () => {
    expect(body).toMatch(/set\s+status\s*=\s*'closed'/i);
    expect(body).toMatch(/'cut_off_batch'/i);
    expect(body).toMatch(/write_audit_log/i);
    expect(body).toMatch(/admin_audit_logs/i);
    expect(allSql).toMatch(/alter\s+type\s+public\.audit_action\s+add\s+value\s+'cut_off_batch'/i);
  });

  it("does not introduce a cron or scheduled job (Lazy Evaluation)", () => {
    expect(allSql).toMatch(/cut_off_batch/i);
    expect(body).not.toMatch(/cron/i);
    expect(body).not.toMatch(/pg_cron/i);
  });

  it("removes default PUBLIC/anon EXECUTE and grants execution only to authenticated", () => {
    expect(allSql).toMatch(/revoke\s+execute\s+on\s+function\s+public\.cut_off_batch/i);
    expect(allSql).toMatch(/grant\s+execute\s+on\s+function\s+public\.cut_off_batch[^;]*to\s+authenticated/i);
  });
});
