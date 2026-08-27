import { describe, expect, it } from "vitest";
import { shiftBatchTimeline } from "@/lib/batches/recurring";
import { TIMELINE_FIELDS, parseBatchTimeline } from "@/lib/batches/timeline";

const BASE = parseBatchTimeline({
  registration_opens_at: "2030-03-04T09:00:00+07:00",
  registration_closes_at: "2030-03-05T09:00:00+07:00",
  payment_opens_at: "2030-03-05T10:00:00+07:00",
  payment_closes_at: "2030-03-06T09:00:00+07:00",
  estimated_ready_at: "2030-03-09T09:00:00+07:00",
});
if (!("data" in BASE)) throw new Error("fixture must be valid");

describe("shiftBatchTimeline", () => {
  it("shifts every timeline parameter by the interval (+7 days)", () => {
    const next = shiftBatchTimeline(BASE.data, 7);
    for (const field of TIMELINE_FIELDS) {
      const before = Date.parse(BASE.data[field]);
      const after = Date.parse(next[field]);
      expect(after - before).toBe(7 * 86_400_000);
    }
  });

  it("keeps the resulting schedule strictly increasing (still valid)", () => {
    const next = shiftBatchTimeline(BASE.data, 14);
    expect(parseBatchTimeline(next)).toHaveProperty("data");
  });

  it("preserves time-of-day in UTC across the shift", () => {
    const next = shiftBatchTimeline(BASE.data, 7);
    expect(new Date(next.registration_opens_at).getUTCHours()).toBe(
      new Date(BASE.data.registration_opens_at).getUTCHours(),
    );
  });

  it("rejects a non-positive interval", () => {
    expect(() => shiftBatchTimeline(BASE.data, 0)).toThrow();
    expect(() => shiftBatchTimeline(BASE.data, -7)).toThrow();
  });
});
