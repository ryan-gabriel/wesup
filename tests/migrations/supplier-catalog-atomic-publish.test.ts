import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const path = join(process.cwd(), "supabase", "migrations", "20260909020000_supplier_catalog_atomic_publish.sql");

describe("atomic supplier catalog publish migration", () => {
  it("updates fields and publishes in one ownership-checked transaction", () => {
    expect(existsSync(path)).toBe(true);
    const source = existsSync(path) ? readFileSync(path, "utf8") : "";
    expect(source).toMatch(/function\s+public\.update_and_publish_supplier_batch/i);
    expect(source).toMatch(/assert_supplier_batch_owner\(p_batch_id\)/i);
    expect(source).toMatch(/update_supplier_batch\(/i);
    expect(source).toMatch(/publish_supplier_batch\(/i);
    expect(source).toMatch(/grant\s+execute[\s\S]*update_and_publish_supplier_batch[\s\S]*authenticated/i);
  });
});
