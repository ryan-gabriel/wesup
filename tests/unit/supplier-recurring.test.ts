import { describe, expect, it } from "vitest";
import {
  computeNextGeneration,
  formatInterval,
  RECURRING_CONFIG_MOCKS,
} from "@/lib/supplier-recurring/mock-data";
import { DAY_LABELS, type DayOfWeek } from "@/lib/supplier-recurring/types";

describe("recurring mock-data (PRD 2.1.4 - Recurring Management)", () => {
  describe("computeNextGeneration", () => {
    it("adds the configured interval in days to the last generation date", () => {
      const last = new Date("2026-08-28T00:00:00.000Z");
      const next = computeNextGeneration(last, 7, []);
      const diffDays = (next.getTime() - last.getTime()) / 86_400_000;
      expect(diffDays).toBe(7);
    });

    it("rolls forward to the next allowed day-of-week when days are specified", () => {
      // Sunday (0) + 7 days = Sunday; but only Mon(1)/Thu(4) allowed -> Monday
      const last = new Date("2026-08-23T00:00:00.000Z"); // Sunday
      const next = computeNextGeneration(last, 7, [1, 4]);
      expect(next.getDay()).toBe(1); // Monday
      expect(next > last).toBe(true);
    });

    it("returns the computed date as-is when no days-of-week restriction", () => {
      const last = new Date("2026-08-23T00:00:00.000Z");
      const next = computeNextGeneration(last, 7, []);
      expect(next.getDay()).toBe(last.getDay());
    });
  });

  describe("formatInterval", () => {
    it("formats common intervals", () => {
      expect(formatInterval(1)).toBe("Setiap hari");
      expect(formatInterval(7)).toBe("Setiap minggu");
      expect(formatInterval(14)).toBe("Setiap 2 minggu");
      expect(formatInterval(30)).toBe("Setiap bulan");
    });

    it("falls back to a generic template for arbitrary intervals", () => {
      expect(formatInterval(5)).toBe("Setiap 5 hari");
      expect(formatInterval(90)).toBe("Setiap 90 hari");
    });
  });

  describe("mock data integrity", () => {
    it("every mock config has a positive interval", () => {
      for (const c of RECURRING_CONFIG_MOCKS) {
        expect(c.intervalDays).toBeGreaterThan(0);
      }
    });

    it("every mock config day-of-week is a valid DayOfWeek label", () => {
      for (const c of RECURRING_CONFIG_MOCKS) {
        for (const d of c.daysOfWeek) {
          expect(DAY_LABELS[d as DayOfWeek]).toBeTruthy();
        }
      }
    });

    it("tier prices decrease as volume increases (no inversion) in template", () => {
      for (const c of RECURRING_CONFIG_MOCKS) {
        const prices = c.templateBatch.tiers.map((t) => t.pricePerUnit);
        for (let i = 1; i < prices.length; i++) {
          expect(prices[i]).toBeLessThan(prices[i - 1]);
        }
      }
    });
  });
});
