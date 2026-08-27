import { describe, expect, it } from "vitest";
import { parseBatchTimeline } from "@/lib/batches/timeline";

const VALID = {
  registration_opens_at: "2030-01-01T00:00:00Z",
  registration_closes_at: "2030-01-02T00:00:00Z",
  payment_opens_at: "2030-01-02T01:00:00Z",
  payment_closes_at: "2030-01-03T00:00:00Z",
  estimated_ready_at: "2030-01-05T00:00:00Z",
};

describe("parseBatchTimeline", () => {
  it("accepts a linear timeline and normalizes to ISO strings", () => {
    const result = parseBatchTimeline(VALID);
    expect(result).toHaveProperty("data");
    if (!("data" in result)) throw new Error("expected data");
    expect(result.data.registration_opens_at).toBe("2030-01-01T00:00:00.000Z");
    expect(result.data.estimated_ready_at).toBe("2030-01-05T00:00:00.000Z");
  });

  it("rejects a non-object timeline", () => {
    expect(parseBatchTimeline(null)).toEqual({ error: "Timeline is required" });
    expect(parseBatchTimeline("x")).toEqual({ error: "Timeline is required" });
  });

  it("rejects missing fields", () => {
    const partial = { ...VALID } as Record<string, unknown>;
    // biome-ignore lint: intentional key removal in test fixture
    delete partial.estimated_ready_at;
    const result = parseBatchTimeline(partial);
    expect("error" in result && result.error).toContain("estimated_ready_at");
  });

  it("rejects unparseable timestamps", () => {
    const result = parseBatchTimeline({ ...VALID, payment_opens_at: "bukan-tanggal" });
    expect("error" in result && result.error).toContain("payment_opens_at");
  });

  it("rejects non-string values that JS would silently coerce into dates", () => {
    for (const garbage of [0, ["2036"], true, null]) {
      const result = parseBatchTimeline({ ...VALID, registration_opens_at: garbage });
      expect("error" in result && result.error).toContain("registration_opens_at");
    }
  });

  it('rejects strings that are not absolute dates ("0", "besok")', () => {
    for (const garbage of ["0", "besok", "March 5, 2030"]) {
      const result = parseBatchTimeline({ ...VALID, payment_closes_at: garbage });
      expect("error" in result && result.error).toContain("payment_closes_at");
    }
  });

  it("rejects out-of-order timestamps (PRD Time-Travel Validation)", () => {
    const result = parseBatchTimeline({
      ...VALID,
      payment_opens_at: "2029-12-31T00:00:00Z",
    });
    expect("error" in result && result.error).toContain("registration_closes_at");
  });

  it("rejects equal adjacent timestamps", () => {
    const result = parseBatchTimeline({
      ...VALID,
      payment_closes_at: VALID.payment_opens_at,
    });
    expect("error" in result && result.error).toContain("payment_closes_at");
  });
});
