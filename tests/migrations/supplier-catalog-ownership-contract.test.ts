import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260909010000_supplier_catalog_ownership_contract.sql",
);

function sql() {
  return existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
}

function functionBody(name: string) {
  return sql().match(
    new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\b[\\s\\S]*?\\$\\$;`, "i"),
  )?.[0] ?? "";
}

describe("supplier catalog ownership contract migration", () => {
  it("adds an additive ownership-contract migration", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(sql()).not.toMatch(/drop\s+table|truncate\s+table/i);
  });

  it("uses a private owner assertion with stable not-found and ownership SQLSTATEs", () => {
    const source = sql();
    const helper = functionBody("assert_supplier_batch_owner");
    expect(helper).toMatch(/security\s+definer/i);
    expect(helper).toMatch(/set\s+search_path\s*=\s*public/i);
    expect(helper).toMatch(/errcode\s*=\s*'P0002'/i);
    expect(helper).toMatch(/errcode\s*=\s*'42501'/i);
    expect(source).toMatch(/revoke\s+execute\s+on\s+function\s+public\.assert_supplier_batch_owner\(uuid\)\s+from\s+public,\s*anon,\s*authenticated/i);
  });

  it.each([
    "get_supplier_batch",
    "update_supplier_batch",
    "publish_supplier_batch",
    "cancel_batch",
    "delete_supplier_batch",
  ])("makes %s invoke the owner assertion with pinned, authenticated execution", (name) => {
    const body = functionBody(name);
    expect(body).toMatch(/security\s+definer/i);
    expect(body).toMatch(/set\s+search_path\s*=\s*public/i);
    expect(body).toMatch(/perform\s+public\.assert_supplier_batch_owner\(p_batch_id\)/i);
    expect(sql()).toMatch(new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${name}\\b[\\s\\S]*?from\\s+public,\\s*anon`, "i"));
    expect(sql()).toMatch(new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\b[\\s\\S]*?to\\s+authenticated`, "i"));
  });

  it("uses stable validation and lifecycle SQLSTATEs", () => {
    const source = sql();
    expect(source).toMatch(/errcode\s*=\s*'22023'/i);
    expect(source).toMatch(/errcode\s*=\s*'55000'/i);
  });

  it("exposes an active approved supplier summary without private contact data", () => {
    const body = functionBody("get_supplier_dashboard_summary");
    expect(body).toMatch(/security\s+definer/i);
    expect(body).toMatch(/set\s+search_path\s*=\s*public/i);
    expect(body).toMatch(/assert_active_approved_supplier\(\)/i);
    expect(body).toMatch(/active_batch_count/i);
    expect(body).toMatch(/total_participant_count/i);
    expect(body).toMatch(/collected_revenue/i);
    expect(body).not.toMatch(/\b(phone|email|nik|ktp_photo_url)\b/i);
  });
  it("accepts normal .webp storage URLs without a doubled regex escape", () => {
    const publish = functionBody("publish_supplier_batch");
    expect(publish).toContain("/[^/]+\\.webp$')");
    expect(publish).not.toContain("\\\\.webp");
  });

  it("lists only the caller's batches through a valid lateral detail query", () => {
    const list = functionBody("list_supplier_batches");
    expect(list).toMatch(/assert_active_approved_supplier\(\)/i);
    expect(list).toMatch(/cross\s+join\s+lateral\s+public\.get_supplier_batch\(b\.id\)/i);
    expect(list).toMatch(/b\.supplier_id\s*=\s*auth\.uid\(\)/i);
  });

  it("normalizes tier and null-timeline validation before DML", () => {
    const validator = functionBody("validate_catalog_tiers");
    const timeline = functionBody("validate_catalog_timeline");
    const update = functionBody("update_supplier_batch");
    expect(validator).toMatch(/errcode\s*=\s*'22023'/i);
    expect(timeline).toMatch(/p_registration_opens_at\s+is\s+null/i);
    expect(timeline).toMatch(/errcode\s*=\s*'22023'/i);
    expect(update).toMatch(/perform\s+public\.validate_catalog_timeline/i);
  });

  it("removes direct catalog DML grants while retaining RPC-only mutation", () => {
    const source = sql();
    expect(source).toMatch(/revoke\s+insert,\s*update,\s*delete\s+on\s+public\.batches,\s*public\.batch_tiers,\s*public\.batch_timeline\s+from\s+public,\s*anon,\s*authenticated/i);
    const policy = source.match(/create\s+policy\s+"batches_supplier_approved_all"[\s\S]*?with\s+check\s*\([\s\S]*?\);/i)?.[0] ?? "";
    expect(policy).toMatch(/supplier_id\s*=\s*auth\.uid\(\)/i);
    expect(policy).toMatch(/p\.status\s*=\s*'active'/i);
    expect(policy).toMatch(/sp\.verification_status\s*=\s*'approved'/i);
  });

  it("uses registration quantities and only lifecycle-eligible supplier escrow in the dashboard", () => {
    const dashboard = functionBody("get_supplier_dashboard_summary");
    expect(dashboard).toMatch(/sum\(r\.quantity\).*registered_quantity/i);
    expect(dashboard).toMatch(/e\.status\s*=\s*'held'/i);
    expect(dashboard).toMatch(/e\.auto_release_at\s*<=\s*now\(\)/i);
    expect(dashboard).toMatch(/coalesce\(e\.release_destination,\s*'supplier'\)\s*=\s*'supplier'/i);
    expect(dashboard).toMatch(/d\.status\s+in\s*\('pending',\s*'under_review'\)/i);
  });
  it("requires explicit missing-key, type, and numeric(12,2) guards before tier casts", () => {
    const tiers = functionBody("validate_catalog_tiers");
    for (const field of ["tier_number", "min_volume", "price_per_unit"]) {
      expect(tiers).toMatch(new RegExp(`not\\s+\\(v_raw\\s*\\?\\s*'${field}'\\)`, "i"));
      expect(tiers).toMatch(new RegExp(`jsonb_typeof\\(v_raw\\s*->\\s*'${field}'\\)\\s*<>\\s*'number'`, "i"));
    }
    expect(tiers).toMatch(/v_raw\s*\?\s*'max_volume'/i);
    expect(tiers).toMatch(/price_per_unit'\)\s*!~\s*'\^-\?\[0-9\]\{1,10\}/i);
    expect(tiers).toMatch(/\(\\\.\[0-9\]\{1,2\}\)\?\$'/i);
    expect(tiers).toMatch(/exception\s+when\s+invalid_text_representation\s+or\s+numeric_value_out_of_range/i);
    expect(tiers).toMatch(/errcode\s*=\s*'22023'/i);
  });

  it("validates every timeline input and tiers before catalog-table DML", () => {
    const timeline = functionBody("validate_catalog_timeline");
    const create = functionBody("create_supplier_batch");
    const update = functionBody("update_supplier_batch");
    for (const field of ["p_registration_opens_at", "p_registration_closes_at", "p_payment_opens_at", "p_payment_closes_at", "p_estimated_ready_at"]) {
      expect(timeline).toMatch(new RegExp(`${field}\\s+is\\s+null`, "i"));
    }
    for (const [body, dml] of [[create, "insert into public.batches"], [update, "update public.batches"]]) {
      const validationIndex = body.indexOf("perform public.validate_catalog_tiers");
      const dmlIndex = body.indexOf(dml);
      expect(validationIndex).toBeGreaterThanOrEqual(0);
      expect(dmlIndex).toBeGreaterThanOrEqual(0);
      expect(validationIndex).toBeLessThan(dmlIndex);
    }
  });

  it("keeps the dispute exclusion nested in ready-to-disburse FILTER", () => {
    const dashboard = functionBody("get_supplier_dashboard_summary");
    const readyFilter = dashboard.match(/coalesce\(sum\(e\.amount\)\s+filter\s*\(\s*where\s+(.+?)\),\s*0\)::numeric\s+as\s+ready_to_disburse/i)?.[1] ?? "";
    expect(readyFilter).not.toBe("");
    const disputeExclusion = readyFilter.match(/not\s+exists\s*\(\s*select\s+1\s+from\s+public\.disputes\s+d\s+where\s+(.+)\)\s*$/i)?.[1] ?? "";
    expect(disputeExclusion).toMatch(/d\.registration_id\s*=\s*e\.registration_id/i);
    expect(disputeExclusion).toMatch(/d\.status\s+in\s*\('pending',\s*'under_review'\)/i);
  });
});
