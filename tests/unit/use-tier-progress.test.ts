// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTierProgress } from "@/hooks/use-tier-progress";
import type { MarketplaceProgressResponse } from "@/lib/marketplace/types";

const INITIAL: MarketplaceProgressResponse = {
  batchId: "44444444-4444-4444-8444-444444444444",
  status: "published",
  registeredQuantity: 30,
  tiers: [
    { tierNumber: 1, minVolume: 1, maxVolume: 49, pricePerUnit: 25000 },
    { tierNumber: 2, minVolume: 50, maxVolume: null, pricePerUnit: 22000 },
  ],
  tierProgress: {
    currentTierNumber: 1,
    currentPricePerUnit: 25000,
    nextTierNumber: 2,
    nextTierMinVolume: 50,
    remainingToNextTier: 20,
    progressPercent: 60,
  },
  registrationClosesAt: "2099-09-15T10:00:00.000Z",
  serverTime: "2026-09-01T12:00:00.000Z",
};

function response(overrides: Partial<MarketplaceProgressResponse> = {}) {
  return new Response(JSON.stringify({ ...INITIAL, ...overrides }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("useTierProgress", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fetches immediately and every four seconds while visible", async () => {
    fetchMock.mockResolvedValue(response({ registeredQuantity: 31 }));
    const { result } = renderHook(() => useTierProgress(INITIAL.batchId, INITIAL));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.progress.registeredQuantity).toBe(31);

    fetchMock.mockResolvedValue(response({ registeredQuantity: 32 }));
    await act(async () => {
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.progress.registeredQuantity).toBe(32);
  });

  it("does not poll while hidden and refetches on focus", async () => {
    fetchMock.mockResolvedValue(response());
    renderHook(() => useTierProgress(INITIAL.batchId, INITIAL));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    fetchMock.mockResolvedValue(response({ registeredQuantity: 33 }));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the last successful snapshot when refresh fails", async () => {
    fetchMock.mockResolvedValue(response());
    const { result } = renderHook(() => useTierProgress(INITIAL.batchId, INITIAL));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRejectedValue(new Error("temporary outage"));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.progress.registeredQuantity).toBe(30);
    expect(result.current.error?.message).toBe("temporary outage");
  });

  it("stops the interval after the server reports a closed batch", async () => {
    fetchMock.mockResolvedValue(response({ status: "closed" }));
    renderHook(() => useTierProgress(INITIAL.batchId, INITIAL));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
