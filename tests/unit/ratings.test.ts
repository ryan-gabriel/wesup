import { describe, expect, it } from "vitest";
import {
  buildRatingBreakdown,
  getRatingScenario,
  isRatingUnlocked,
} from "@/lib/ratings/aggregate";
import {
  getRatingScenarioForOrder,
  getSubmittedRating,
  RATING_RECORD_MOCKS,
} from "@/lib/ratings/mock-data";
import type { RatingRecord } from "@/lib/ratings/types";
import type { AccountOrderStatus } from "@/lib/orders/types";

type Role = "buyer" | "supplier";

function order(status: AccountOrderStatus, role: Role = "buyer") {
  return { role, status };
}

const SAMPLE_RATING: RatingRecord = {
  orderId: "ord-sample",
  score: 5,
  comment: "Bagus",
  createdAt: "2026-09-01T03:00:00.000Z",
};

describe("isRatingUnlocked (PRD 2.2.6 Business Rule)", () => {
  it("unlocks only when physical pickup (serah-terima) has completed", () => {
    expect(isRatingUnlocked(order("picked_up"))).toBe(true);
  });

  it("stays locked for every status before pickup", () => {
    for (const status of ["registered", "pending_payment", "paid"] as const) {
      expect(isRatingUnlocked(order(status))).toBe(false);
    }
  });

  it("is locked for no_show (Validasi Input PRD 2.2.6)", () => {
    expect(isRatingUnlocked(order("no_show"))).toBe(false);
  });

  it("is locked for cancelled transactions", () => {
    expect(isRatingUnlocked(order("cancelled"))).toBe(false);
  });

  it("never unlocks from supplier-side order rows", () => {
    expect(isRatingUnlocked({ role: "supplier", status: "picked_up" })).toBe(false);
  });
});

describe("getRatingScenario", () => {
  it("returns already_rated when a rating already exists per registration", () => {
    const scenario = getRatingScenario(order("picked_up"), SAMPLE_RATING);
    expect(scenario.kind).toBe("already_rated");
  });

  it("returns blocked_no_show for no_show orders", () => {
    expect(getRatingScenario(order("no_show")).kind).toBe("blocked_no_show");
  });

  it("returns unlocked for buyer picked_up without an existing rating", () => {
    expect(getRatingScenario(order("picked_up")).kind).toBe("unlocked");
  });

  it("returns locked_pre_pickup before fulfillment completes", () => {
    expect(getRatingScenario(order("paid")).kind).toBe("locked_pre_pickup");
    expect(getRatingScenario(order("cancelled")).kind).toBe("locked_pre_pickup");
    expect(getRatingScenario(order("registered")).kind).toBe("locked_pre_pickup");
  });

  it("returns locked_pre_pickup for supplier-side rows even when picked_up", () => {
    const scenario = getRatingScenario({ role: "supplier", status: "picked_up" });
    expect(scenario.kind).toBe("locked_pre_pickup");
  });
});

describe("mock scenario resolution (lib/ratings/mock-data)", () => {
  it("unlocks ord-umkm-003 (picked_up, belum dinilai)", () => {
    expect(getRatingScenarioForOrder("ord-umkm-003").kind).toBe("unlocked");
  });

  it("returns already_rated with a valid 1-5 score for ord-umkm-008", () => {
    const scenario = getRatingScenarioForOrder("ord-umkm-008");
    expect(scenario.kind).toBe("already_rated");
    if (scenario.kind === "already_rated") {
      expect(scenario.rating.score).toBeGreaterThanOrEqual(1);
      expect(scenario.rating.score).toBeLessThanOrEqual(5);
    }
  });

  it("blocks rating for no_show ord-umkm-005 (Validasi Input)", () => {
    expect(getRatingScenarioForOrder("ord-umkm-005").kind).toBe("blocked_no_show");
  });

  it("locks unpaid ord-umkm-001 (pickup belum rampung)", () => {
    expect(getRatingScenarioForOrder("ord-umkm-001").kind).toBe("locked_pre_pickup");
  });

  it("locks a supplier-side row (ord-sup-001) even after pickup", () => {
    expect(getRatingScenarioForOrder("ord-sup-002").kind).toBe("locked_pre_pickup");
  });

  it("exposes a non-empty record set for aggregation", () => {
    expect(RATING_RECORD_MOCKS.length).toBeGreaterThan(0);
    expect(getSubmittedRating("ord-umkm-008")).not.toBeNull();
  });
});

describe("buildRatingBreakdown", () => {
  it("computes average, total, and per-score counts", () => {
    const breakdown = buildRatingBreakdown([
      { score: 5 },
      { score: 5 },
      { score: 4 },
      { score: 3 },
      { score: 1 },
    ]);
    expect(breakdown.total).toBe(5);
    expect(breakdown.average).toBeCloseTo(3.6, 2);
    expect(breakdown.scoreCounts[5]).toBe(2);
    expect(breakdown.scoreCounts[4]).toBe(1);
    expect(breakdown.scoreCounts[3]).toBe(1);
    expect(breakdown.scoreCounts[2]).toBe(0);
    expect(breakdown.scoreCounts[1]).toBe(1);
  });

  it("returns a zeroed breakdown for empty input", () => {
    const breakdown = buildRatingBreakdown([]);
    expect(breakdown.total).toBe(0);
    expect(breakdown.average).toBe(0);
    expect(breakdown.scoreCounts[5]).toBe(0);
    expect(breakdown.scoreCounts[1]).toBe(0);
  });
});