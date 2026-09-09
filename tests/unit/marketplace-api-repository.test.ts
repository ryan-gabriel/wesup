import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { marketplaceApiRepository } from "@/lib/marketplace/api-repository";

const CRITERIA = {
  query: "cabai",
  selectedCategories: ["Sayur & Buah"] as const,
  minPrice: 18000,
  maxPrice: 30000,
  radiusKm: 12,
  page: 2,
  pageSize: 12 as const,
};

const RESPONSE = {
  items: [],
  total: 0,
  page: 2,
  pageSize: 12,
  totalPages: 0,
  origin: {
    latitude: -6.914744,
    longitude: 107.60981,
    source: "bandung_default" as const,
  },
};

describe("marketplaceApiRepository", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the canonical search request and returns the API DTO", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(RESPONSE), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const controller = new AbortController();

    await expect(
      marketplaceApiRepository.search(CRITERIA, { signal: controller.signal }),
    ).resolves.toEqual(RESPONSE);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const params = new URLSearchParams(url.split("?")[1]);
    expect(url.startsWith("/api/marketplace/search?")).toBe(true);
    expect(params.get("q")).toBe("cabai");
    expect(params.get("categories")).toBe("Sayur & Buah");
    expect(params.get("radius")).toBe("12");
    expect(params.get("page")).toBe("2");
    expect(params.get("limit")).toBe("12");
    expect(params.get("minPrice")).toBe("18000");
    expect(params.get("maxPrice")).toBe("30000");
    expect(options).toEqual({ signal: controller.signal, cache: "no-store" });
  });

  it("surfaces the server error message for failed responses", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Penawaran belum bisa dimuat" }), {
        status: 503,
        statusText: "Service Unavailable",
      }),
    );

    await expect(marketplaceApiRepository.search(CRITERIA)).rejects.toThrow(
      "Penawaran belum bisa dimuat",
    );
  });

  it("preserves abort signals for cancelled searches", async () => {
    const controller = new AbortController();
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));
    await expect(
      marketplaceApiRepository.search(CRITERIA, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock.mock.calls[0][1]).toEqual({ signal: controller.signal, cache: "no-store" });
  });
});
