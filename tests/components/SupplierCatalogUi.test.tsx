// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderComponent as render } from "./test-utils";
import type { SupplierBatchDetail } from "@/lib/supplier-batch/types";
import CatalogListClient from "@/components/supplier/catalog/CatalogListClient";
import CatalogCard from "@/components/supplier/catalog/CatalogCard";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/supplier-catalog/api-repository", () => ({ supplierCatalogApiRepository: { list }, }));

const PROJECT_SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://woxgghuoeljagnkldqtf.supabase.co").replace(/\/$/, "");

const ITEM: SupplierBatchDetail = {
  id: "44444444-4444-4444-8444-444444444444",
  displayCode: "BATCH-44444444",
  title: "Beras real",
  supplierName: "Supplier Bandung",
  category: "Makanan Siap Saji",
  imageUrl: PROJECT_SUPABASE_URL + "/storage/v1/object/public/wesup-public/products/batch-444/beras.webp",
  description: "Beras untuk UMKM",
  status: "PUBLISHED",
  basePrice: 75_000,
  targetQuantity: 50,
  registeredQuantity: 12,
  participantCount: 2,
  paidParticipantCount: 0,
  tiers: [{ tierNumber: 1, minimumQuantity: 1, maximumQuantity: 49, pricePerUnit: 75_000 }, { tierNumber: 2, minimumQuantity: 50, maximumQuantity: null, pricePerUnit: 68_000 }],
  timeline: { registrationOpensAt: "2099-01-01T01:00:00.000Z", registrationClosesAt: "2099-01-02T01:00:00.000Z", paymentOpensAt: "2099-01-02T02:00:00.000Z", paymentClosesAt: "2099-01-03T02:00:00.000Z", estimatedReadyAt: "2099-01-04T02:00:00.000Z" },
  pickup: { name: "Gudang Bandung", address: "Jl. Asia Afrika", latitude: -6.92, longitude: 107.61 },
  cancellation: null,
};

const response = (items: SupplierBatchDetail[] = [ITEM]) => ({ items, counts: { ALL: items.length, DRAFT: 0, PUBLISHED: items.length, CLOSED: 0, CANCELLED_BY_SUPPLIER: 0, TAKEDOWN: 0, COMPLETED: 0 } });

describe("supplier catalog UI states", () => {
  beforeEach(() => { list.mockReset(); });
  it("shows skeleton then real API cards and photo", async () => {
    list.mockResolvedValue(response());
    render(<CatalogListClient />);
    expect(screen.getByRole("region", { name: /daftar katalog/i })).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(screen.getByText("Beras real")).toBeInTheDocument());
    expect(screen.getByAltText("Foto produk Beras real")).toHaveAttribute("src");
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ query: "" }));
  });
  it("renders an empty state for an empty API response", async () => {
    list.mockResolvedValue(response([]));
    render(<CatalogListClient />);
    await waitFor(() => expect(screen.getByText(/belum ada katalog/i)).toBeInTheDocument());
    expect(screen.getAllByRole("link", { name: /buat penawaran/i }).length).toBeGreaterThan(0);
  });
  it("renders retryable API errors", async () => {
    list.mockRejectedValue(new Error("Internal server error"));
    render(<CatalogListClient />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Internal server error"));
    expect(screen.getByRole("button", { name: /coba lagi/i })).toBeInTheDocument();
  });
  it("renders the real image and active status on a catalog card", () => {
    render(<CatalogCard batch={ITEM} />);
    expect(screen.getByText("Aktif")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Foto produk Beras real" })).toBeInTheDocument();
  });
  it("falls back to the product placeholder when the image fails", async () => {
    render(<CatalogCard batch={ITEM} />);
    const image = screen.getByRole("img", { name: "Foto produk Beras real" });
    image.dispatchEvent(new Event("error"));
    await waitFor(() => expect(screen.queryByRole("img", { name: "Foto produk Beras real" })).not.toBeInTheDocument());
    expect(screen.getByText("Aktif")).toBeInTheDocument();
  });
  it.each([
    "https://evil.example/products/beras.webp",
    "not-a-valid-image-url",
    PROJECT_SUPABASE_URL + "/storage/v1/object/public/wesup-public/products/batch-444/beras.webp?download=1",
    PROJECT_SUPABASE_URL + "/storage/v1/object/public/other-bucket/beras.webp",
  ])("uses the placeholder for a disallowed URL", (url) => {
    render(<CatalogCard batch={{ ...ITEM, imageUrl: url }} />);
    expect(screen.queryByRole("img", { name: "Foto produk Beras real" })).not.toBeInTheDocument();
    expect(screen.getByText("Aktif")).toBeInTheDocument();
  });
});