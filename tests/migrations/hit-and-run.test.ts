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

// J1 — Auto-Suspend Hit & Run (PRD 3.4): eskalasi strike pasca-payment-window

describe("apply_hit_and_run (Hit & Run auto-suspend)", () => {
  let allSql: string;
  let body: string;

  beforeAll(() => {
    allSql = readAllSql();
    body = lastFunction(allSql, "apply_hit_and_run");
  });

  it("is defined and security definer", () => {
    expect(body).toMatch(/create\s+or\s+replace\s+function\s+public\.apply_hit_and_run/i);
    expect(body).toMatch(/security\s+definer/i);
  });

  it("requires a signed-in caller and authorizes admin or owning supplier", () => {
    expect(body).toMatch(/auth\.uid\(\) is null/i);
    expect(body).toMatch(/public\.is_admin\(\)/i);
  });

  it("refuses to run before the payment window closes", () => {
    expect(body).toMatch(/payment_closes_at/i);
    expect(body).toMatch(/payment window still open/i);
  });

  it("strikes only unpaid pending_payment registrations (paid excluded)", () => {
    expect(body).toMatch(/pending_payment/i);
    expect(body).toMatch(/is\s+distinct\s+from\s+'paid'/i);
  });

  it("escalates strike 1 → warning, 2 → 7-day suspend, 3+ → permanent", () => {
    expect(body).toMatch(/strike_count\s*\+\s*1/i);
    expect(body).toMatch(/suspended_temporary/i);
    expect(body).toMatch(/payment_closes_at\s*\+\s*interval\s*'7 days'/i);
    expect(body).toMatch(/suspended_permanent/i);
  });

  it("notifies every struck UMKM and cancels their dead order", () => {
    expect(body).toMatch(/insert\s+into\s+.*notifications/i);
    expect(body).toMatch(/status\s*=\s*'cancelled'/i);
  });

  it("audits the run and restricts execution to authenticated", () => {
    expect(allSql).toMatch(/alter\s+type\s+public\.audit_action\s+add\s+value\s+'apply_hit_and_run'/i);
    expect(body).toMatch(/apply_hit_and_run/i);
    expect(allSql).toMatch(/revoke\s+execute\s+on\s+function\s+public\.apply_hit_and_run/i);
    expect(allSql).toMatch(/grant\s+execute\s+on\s+function\s+public\.apply_hit_and_run[^;]*to\s+authenticated/i);
  });
});

describe("resolve_dispute irreversibility (Arbiter, PRD 2.3.4)", () => {
  let body: string;

  beforeAll(() => {
    body = lastFunction(readAllSql(), "resolve_dispute");
  });

  it("refuses to re-resolve an already decided dispute", () => {
    expect(body).toMatch(/status\s+in\s*\(\s*'pending'\s*,\s*'under_review'\s*\)/i);
    expect(body).toMatch(/already resolved/i);
  });
});
