import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260909000000_supplier_catalog_persistence.sql",
);

function sql() {
  return existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
}

describe("supplier catalog persistence migration", () => {
  it("adds pickup_name without dropping existing data", () => {
    const source = sql();
    expect(source).toMatch(/alter\s+table\s+public\.batches\s+add\s+column\s+if\s+not\s+exists\s+pickup_name/i);
    expect(source).toMatch(/update\s+public\.batches[\s\S]*pickup_name\s*=\s*pickup_address/i);
    expect(source).not.toMatch(/drop\s+table|truncate\s+table/i);
  });

  it.each([
    "create_supplier_batch",
    "publish_supplier_batch",
    "update_supplier_batch",
    "get_supplier_batch",
    "list_supplier_batches",
    "delete_supplier_batch",
  ])("defines %s as an authenticated security-definer RPC", (name) => {
    const source = sql();
    const body = source.match(new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\b[\\s\\S]*?\\$\\$;`, "i"))?.[0] ?? "";
    expect(body).toMatch(/security\s+definer/i);
    expect(body).toMatch(/set\s+search_path\s*=\s*public/i);
    expect(source).toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\b[\\s\\S]*?to\\s+authenticated`, "i"));
    expect(source).toMatch(new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${name}\\b[\\s\\S]*?from\\s+public,\\s*anon`, "i"));
  });

  it("encodes supplier ownership, approval, and participant locks", () => {
    const source = sql();
    expect(source).toMatch(/verification_status\s*=\s*'approved'/i);
    expect(source).toMatch(/supplier_id\s*=\s*auth\.uid\(\)/i);
    expect(source).toMatch(/count[\s\S]*registrations/i);
    expect(source).toMatch(/location.*lock|locked.*location/i);
    expect(source).toMatch(/tier.*lock|locked.*tier/i);
  });
});
