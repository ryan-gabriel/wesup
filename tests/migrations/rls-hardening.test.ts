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

describe("auth & RLS hardening migration", () => {
  let allSql: string;
  beforeAll(() => {
    allSql = readAllSql();
  });

  it("forces every new signup to the umkm role", () => {
    const body = functionBody(allSql, "handle_new_user");
    expect(body).toMatch(/'umkm'/i);
    expect(body).not.toMatch(/raw_user_meta_data\s*->>\s*'role'/i);
  });

  it("restricts profile updates to safe columns only", () => {
    expect(allSql).toMatch(/revoke\s+update\s+on\s+public\.profiles/i);
    expect(allSql).toMatch(
      /grant\s+update\s+\(full_name,\s*phone,\s*updated_at\)\s+on\s+public\.profiles/i,
    );
  });

  it("restricts supplier_profiles writes to safe columns only", () => {
    expect(allSql).toMatch(
      /revoke\s+insert,\s*update\s+on\s+public\.supplier_profiles/i,
    );
    expect(allSql).toMatch(
      /grant\s+insert\s+\(user_id,\s*business_name,\s*address,\s*latitude,\s*longitude,\s*business_photo_url,\s*ktp_photo_url,\s*nik\)\s*on\s+public\.supplier_profiles/i,
    );
    expect(allSql).toMatch(
      /grant\s+update\s+\(business_name,\s*address,\s*latitude,\s*longitude,\s*business_photo_url,\s*ktp_photo_url,\s*nik,\s*updated_at\)\s*on\s+public\.supplier_profiles/i,
    );
  });

  it("gates supplier approval behind an active-admin rpc", () => {
    const body = functionBody(allSql, "approve_supplier");
    expect(body).toMatch(/public\.is_admin\(\)/i);
    expect(body).toMatch(/verification_status\s*=\s*'approved'/i);
  });

  it("gates admin and supplier privileges on active status", () => {
    for (const fn of ["is_admin", "is_supplier"]) {
      const body = functionBody(allSql, fn);
      expect(body, `${fn} body should require active status`).toMatch(
        /status\s*=\s*'active'/i,
      );
    }
  });
});
