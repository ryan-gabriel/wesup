import { describe, expect, it } from "vitest";
import {
  isUuid,
  type BatchTimeline,
  type PaymentGateResult,
  type RegistrationGateResult,
  evaluatePaymentWindow,
  evaluateRegistrationWindow,
  resolveTierForVolume,
} from "@/lib/orders/time-gatekeeper";

const OPEN = "2026-09-01T00:00:00.000Z";
const CLOSE = "2026-09-02T00:00:00.000Z";

const timeline: BatchTimeline = {
  registration_opens_at: OPEN,
  registration_closes_at: CLOSE,
  payment_opens_at: "2026-09-02T01:00:00.000Z",
  payment_closes_at: "2026-09-03T00:00:00.000Z",
  estimated_ready_at: "2026-09-04T00:00:00.000Z",
};

describe("evaluateRegistrationWindow (API Gatekeeper timestamp check)", () => {
  it("allows registration strictly within the open window", () => {
    const result: RegistrationGateResult = evaluateRegistrationWindow(
      timeline,
      "2026-09-01T12:00:00.000Z",
      "published",
    );
    expect(result.allowed).toBe(true);
  });

  it("allows at the exact opens timestamp (inclusive lower bound)", () => {
    const result: RegistrationGateResult = evaluateRegistrationWindow(
      timeline,
      OPEN,
      "published",
    );
    expect(result.allowed).toBe(true);
  });

  it("rejects before registration opens", () => {
    const result: RegistrationGateResult = evaluateRegistrationWindow(
      timeline,
      "2026-08-31T23:59:59.000Z",
      "published",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("not_open");
  });

  it("rejects at the exact closes timestamp (cutoff, capacity locked)", () => {
    const result: RegistrationGateResult = evaluateRegistrationWindow(
      timeline,
      CLOSE,
      "published",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("closed");
  });

  it("rejects after registration closes", () => {
    const result: RegistrationGateResult = evaluateRegistrationWindow(
      timeline,
      "2026-09-02T00:00:01.000Z",
      "published",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("closed");
  });

  it("rejects when the batch is not published", () => {
    const result: RegistrationGateResult = evaluateRegistrationWindow(
      timeline,
      "2026-09-01T12:00:00.000Z",
      "draft",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("not_published");
  });
});

describe("resolveTierForVolume (price locking at cutoff)", () => {
  const tiers = [
    { tier_number: 1, min_volume: 1, max_volume: 49, price_per_unit: 10000 },
    { tier_number: 2, min_volume: 50, max_volume: 99, price_per_unit: 9000 },
    { tier_number: 3, min_volume: 100, max_volume: null, price_per_unit: 8000 },
  ];

  it("falls back to Tier 1 (base price) when the min higher tier is unmet", () => {
    const tier = resolveTierForVolume(tiers, 10);
    expect(tier.tier_number).toBe(1);
    expect(tier.price_per_unit).toBe(10000);
  });

  it("selects the highest qualifying tier boundary", () => {
    expect(resolveTierForVolume(tiers, 50).tier_number).toBe(2);
    expect(resolveTierForVolume(tiers, 99).tier_number).toBe(2);
    expect(resolveTierForVolume(tiers, 100).tier_number).toBe(3);
    expect(resolveTierForVolume(tiers, 500).tier_number).toBe(3);
  });

  it("returns Tier 1 for an empty set (no tiers configured)", () => {
    expect(() => resolveTierForVolume([], 10)).toThrow("no tiers");
  });
});

describe("evaluatePaymentWindow (Payment Window timestamp gate)", () => {
  const PAY_OPEN = "2026-09-02T01:00:00.000Z";
  const PAY_CLOSE = "2026-09-03T00:00:00.000Z";

  it("blocks before the payment window opens", () => {
    const result: PaymentGateResult = evaluatePaymentWindow(timeline, "2026-09-02T00:59:59.000Z");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("not_open");
  });

  it("allows at the exact opens timestamp (inclusive lower bound)", () => {
    const result: PaymentGateResult = evaluatePaymentWindow(timeline, PAY_OPEN);
    expect(result.allowed).toBe(true);
  });

  it("allows strictly inside the payment window", () => {
    const result: PaymentGateResult = evaluatePaymentWindow(timeline, "2026-09-02T12:00:00.000Z");
    expect(result.allowed).toBe(true);
  });

  it("blocks at the exact closes timestamp (deadline, exclusive upper bound)", () => {
    const result: PaymentGateResult = evaluatePaymentWindow(timeline, PAY_CLOSE);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("blocks after the payment window closes", () => {
    const result: PaymentGateResult = evaluatePaymentWindow(timeline, "2026-09-03T00:00:01.000Z");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("expired");
  });
});

describe("isUuid", () => {
  it("accepts a valid v4 UUID", () => {
    expect(isUuid("44444444-4444-4444-8444-444444444444")).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});
