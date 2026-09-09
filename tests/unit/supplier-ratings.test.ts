import { describe, expect, it } from "vitest";
import {
  SUPPLIER_RATINGS_MOCKS,
  getSupplierRatings,
  ratingBarsFor,
} from "@/lib/supplier-ratings/mock-data";

describe("supplier-ratings (PRD 2.2.6)", () => {
  it("exposes at least one supplier rating fixture", () => {
    expect(SUPPLIER_RATINGS_MOCKS.length).toBeGreaterThan(0);
  });

  it("keeps score counts, total, and average consistent in every fixture", () => {
    for (const entry of SUPPLIER_RATINGS_MOCKS) {
      const countSum = Object.values(entry.scoreCounts).reduce(
        (acc, value) => acc + value,
        0,
      );
      expect(countSum).toBe(entry.total);
      expect(entry.average).toBeGreaterThanOrEqual(1);
      expect(entry.average).toBeLessThanOrEqual(5);
      expect(entry.recent.length).toBeGreaterThan(0);
    }
  });

  it("resolves ratings for the mock supplier used in the dashboard", () => {
    const found = getSupplierRatings("Koperasi Pangan Bandung");
    expect(found).not.toBeNull();
    expect(found!.total).toBeGreaterThan(0);
    expect(found!.average).toBeGreaterThanOrEqual(1);
    expect(found!.average).toBeLessThanOrEqual(5);
  });

  it("returns null for unknown suppliers", () => {
    expect(getSupplierRatings("Supplier Fiktif Nama")).toBeNull();
  });

  it("builds bar distribution rows that preserve counts and percentages", () => {
    const summary = getSupplierRatings("Koperasi Pangan Bandung")!;
    const bars = ratingBarsFor(summary);
    expect(bars).toHaveLength(5);
    for (const bar of bars) {
      expect(bar.count).toBe(summary.scoreCounts[bar.score]);
      expect(bar.pct).toBeGreaterThanOrEqual(0);
      expect(bar.pct).toBeLessThanOrEqual(100);
    }
    const totalCounted = bars.reduce((acc, bar) => acc + bar.count, 0);
    expect(totalCounted).toBe(summary.total);
  });
});