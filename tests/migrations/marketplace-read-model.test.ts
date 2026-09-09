import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readAllSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

function functionBody(sql: string, name: string): string {
  const matches = [
    ...sql.matchAll(
      new RegExp(
        `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\b[\\s\\S]*?\\$\\$;`,
        "gi",
      ),
    ),
  ];
  return matches.at(-1)?.[0] ?? "";
}

describe("marketplace dynamic read model migration", () => {
  const allSql = readAllSql();

  it("adds the immutable timestamped migration", () => {
    expect(
      existsSync(join(MIGRATIONS_DIR, "20260908000000_marketplace_dynamic_read_model.sql")),
    ).toBe(true);
  });

  it.each(["search_batches", "get_marketplace_batch"])(
    "%s is a security-definer function with a pinned search_path",
    (name) => {
      const body = functionBody(allSql, name);
      expect(body).toMatch(/security\s+definer/i);
      expect(body).toMatch(/set\s+search_path\s*=\s*public/i);
      expect(body).toMatch(/b\.status\s*=\s*'published'/i);
    },
  );

  it("searches by achieved tier price and quantity aggregate", () => {
    const body = functionBody(allSql, "search_batches");
    expect(body).toMatch(/p_min_price\s+numeric/i);
    expect(body).toMatch(/p_max_price\s+numeric/i);
    expect(body).toMatch(/sum\(r\.quantity\)/i);
    expect(body).toMatch(/r\.status\s+in\s*\(\s*'registered'\s*,\s*'pending_payment'\s*\)/i);
    expect(body).toMatch(/current_price_per_unit/i);
    expect(body).toMatch(/count\(\*\)\s+over/i);
  });

  it("exposes only the intended anonymous/authenticated execute grants", () => {
    expect(allSql).toMatch(/revoke\s+execute\s+on\s+function\s+public\.search_batches[\s\S]*?from\s+public,\s*anon,\s*authenticated/i);
    expect(allSql).toMatch(/grant\s+execute\s+on\s+function\s+public\.search_batches[\s\S]*?to\s+anon,\s*authenticated/i);
    expect(allSql).toMatch(/revoke\s+execute\s+on\s+function\s+public\.get_marketplace_batch[\s\S]*?from\s+public,\s*anon,\s*authenticated/i);
    expect(allSql).toMatch(/grant\s+execute\s+on\s+function\s+public\.get_marketplace_batch[\s\S]*?to\s+anon,\s*authenticated/i);
  });
});
