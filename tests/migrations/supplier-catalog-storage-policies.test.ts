import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260909050000_restore_supplier_product_storage_policies.sql",
);

function sql() {
  return existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
}

describe("supplier product Storage policy repair migration", () => {
  it("exists as an additive, non-destructive migration", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(sql()).not.toMatch(/drop\s+(?:table|schema)|truncate\s+table/i);
  });

  it.each([
    ["storage_objects_products_insert", "insert", "with check"],
    ["storage_objects_products_delete", "delete", "using"],
  ])("restores %s for authenticated product objects", (policy, operation, clause) => {
    const source = sql();
    const body = source.match(new RegExp(`create\\s+policy\\s+"${policy}"[\\s\\S]*?;`, "i"))?.[0] ?? "";
    expect(body).toMatch(new RegExp(`for\\s+${operation}\\s+to\\s+authenticated`, "i"));
    expect(body).toMatch(new RegExp(`${clause}\\s*\\(`, "i"));
    expect(body).toMatch(/bucket_id\s*=\s*'wesup-public'/i);
    expect(body).toMatch(/name\s+like\s+'products\/%'/i);
    expect(body).toMatch(/storage_is_batch_supplier\(name\)/i);
    expect(body).toMatch(/storage_is_admin\(\)/i);
  });

  it("recreates policies idempotently without removing public SELECT", () => {
    const source = sql();
    expect(source).toMatch(/drop\s+policy\s+if\s+exists\s+"storage_objects_products_insert"/i);
    expect(source).toMatch(/drop\s+policy\s+if\s+exists\s+"storage_objects_products_delete"/i);
    expect(source).not.toMatch(/drop\s+policy\s+if\s+exists\s+"storage_objects_products_select"/i);
  });

  it("pins SECURITY DEFINER helper search paths", () => {
    const source = sql();
    expect(source).toMatch(/function\s+public\.storage_is_admin\(\)[\s\S]*?security\s+definer\s+set\s+search_path\s*=\s*public/i);
    expect(source).toMatch(/function\s+public\.storage_is_batch_supplier\(object_name\s+text\)[\s\S]*?security\s+definer\s+set\s+search_path\s*=\s*public/i);
  });

  it("keeps the upload path non-upserting", () => {
    const route = readFileSync(join(process.cwd(), "app", "api", "suppliers", "batches", "route.ts"), "utf8");
    expect(route).toMatch(/storage\.from\("wesup-public"\)\.upload\([\s\S]*?upsert:\s*false/i);
  });
});
