// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderComponent as render } from "./test-utils";
import type { SupplierBatchDetail } from "@/lib/supplier-batch/types";
import SupplierDashboard from "@/components/supplier/dashboard/SupplierDashboard";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/supplier-catalog/dashboard-repository", () => ({ supplierDashboardRepository: { get } }));

const BATCH: SupplierBatchDetail = {
  id: "44444444-4444-4444-8444-444444444444",
  displayCode: "BATCH-44444444",
  title: "Beras Supplier A",
  supplierName: "Supplier A",
  category: "Makanan Siap Saji",
  imageUrl: "https://example.test/beras.webp",
  description: "Beras nyata",
  status: "PUBLISHED",
  basePrice: 75_000,
  targetQuantity: 50,
  registeredQuantity: 12,
  participantCount: 3,
  paidParticipantCount: 1,
  tiers: [{ tierNumber: 1, minimumQuantity: 1, maximumQuantity: null, pricePerUnit: 75_000 }],
  timeline: { registrationOpensAt: "2099-01-01T01:00:00.000Z", registrationClosesAt: "2099-01-02T01:00:00.000Z", paymentOpensAt: "2099-01-02T02:00:00.000Z", paymentClosesAt: "2099-01-03T02:00:00.000Z", estimatedReadyAt: "2099-01-04T02:00:00.000Z" },
  pickup: { name: "Gudang A", address: "Bandung", latitude: -6.92, longitude: 107.61 },
  cancellation: null,
};

function response(recentBatches: SupplierBatchDetail[] = [BATCH]) {
  return {
    supplier: { displayName: "Supplier A", verificationStatus: "approved" },
    summary: { activeBatchCount: 2, participantCount: 11, collectedRevenue: 650_000, readyToDisburse: 125_000, ratingAverage: 4.5, ratingTotal: 3 },
    recentBatches,
  };
}

describe("SupplierDashboard real-data states", () => {
  beforeEach(() => get.mockReset());

  it("shows a skeleton and then the logged-in supplier data", async () => {
    get.mockResolvedValue(response());
    render(<SupplierDashboard />);
    expect(screen.getByLabelText(/memuat dashboard supplier/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/selamat datang, supplier a/i)).toBeInTheDocument());
    expect(screen.getByText("Beras Supplier A")).toBeInTheDocument();
    expect(screen.getByText("Katalog Aktif")).toBeInTheDocument();
  });

  it("shows an empty state when the API returns no owned batches", async () => {
    get.mockResolvedValue(response([]));
    render(<SupplierDashboard />);
    await waitFor(() => expect(screen.getByText(/belum ada katalog/i)).toBeInTheDocument());
  });

  it("shows an error and retries the API request", async () => {
    get.mockRejectedValueOnce(new Error("Dashboard unavailable")).mockResolvedValueOnce(response());
    render(<SupplierDashboard />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Dashboard unavailable"));
    await screen.getByRole("button", { name: /coba lagi/i }).click();
    await waitFor(() => expect(screen.getByText(/selamat datang, supplier a/i)).toBeInTheDocument());
    expect(get).toHaveBeenCalledTimes(2);
  });
});
