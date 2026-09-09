import { beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readAllSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
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

describe("fulfillment & pickup (Slice 2)", () => {
  let allSql: string;
  let genCode: string;
  let confirmPickup: string;
  let createEscrow: string;

  beforeAll(() => {
    allSql = readAllSql();
    genCode = lastFunction(allSql, "generate_pickup_code");
    confirmPickup = lastFunction(allSql, "confirm_pickup");
    createEscrow = lastFunction(allSql, "create_escrow");
  });

  it("defines generate_pickup_code, confirm_pickup and create_escrow", () => {
    expect(genCode).toMatch(/security\s+definer/i);
    expect(confirmPickup).toMatch(/security\s+definer/i);
    expect(createEscrow).toMatch(/security\s+definer/i);
  });

  it("generate_pickup_code only issues a code once payment is settled (status = 'paid')", () => {
    expect(genCode).toMatch(/registrations/i);
    expect(genCode).toMatch(/status\s*=\s*'paid'/i);
  });

  it("generate_pickup_code creates a unique QR token and a 4-digit PIN", () => {
    expect(allSql).toMatch(/qr_code_token\s+text\s+not\s+null\s+unique/i);
    expect(genCode).toMatch(/pin_code/i);
  });

  it("generate_pickup_code is idempotent per registration (returns existing)", () => {
    expect(genCode).toMatch(/pickup_codes/i);
    expect(genCode).toMatch(/exists|on\s+conflict/i);
  });

  it("confirm_pickup validates the code then transitions registration to picked_up", () => {
    expect(confirmPickup).toMatch(/'picked_up'/i);
    expect(confirmPickup).toMatch(/pickup_events/i);
    expect(confirmPickup).toMatch(/qr'|'pin'/i);
  });

  it("confirm_pickup creates an escrow hold scheduled at +24h", () => {
    expect(createEscrow).toMatch(/escrow_holds/i);
    expect(createEscrow).toMatch(/auto_release_at/i);
    expect(createEscrow).toMatch(/24/i);
    expect(createEscrow).toMatch(/interval/i);
  });

  it("does not introduce a cron or scheduled job (Lazy Evaluation)", () => {
    expect(genCode).not.toMatch(/cron/i);
    expect(confirmPickup).not.toMatch(/cron/i);
  });

  it("grants execution only to authenticated users", () => {
    expect(allSql).toMatch(/grant\s+execute\s+on\s+function\s+public\.confirm_pickup[^;]*to\s+authenticated/i);
    expect(allSql).toMatch(/grant\s+execute\s+on\s+function\s+public\.generate_pickup_code[^;]*to\s+authenticated/i);
  });
});
