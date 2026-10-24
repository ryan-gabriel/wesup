// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import OfferDraftList from "@/components/supplier/catalog/OfferDraftListClient";
import SupplierBatchTransactionCenter from "@/components/supplier-batch/SupplierBatchTransactionCenter";

const resource = vi.hoisted(() => ({ data: { items: [] }, loading: false, error: "", reload: vi.fn() }));
vi.mock("@/lib/feedback/use-resource", () => ({ useFeedbackResource: () => resource }));
vi.mock("@/components/orders/TransactionSupport", () => ({ default: () => null }));
// This suite verifies the catalog return link; batch-detail fetching is covered separately.
vi.mock("@/components/supplier-batch/SupplierBatchDetailClient", () => ({ default: () => null }));
vi.mock("@/lib/supplier-catalog/api-repository", () => ({ supplierCatalogApiRepository: { getTransaction: vi.fn(async () => ({
  batch: { title: "Beras", status: "published" }, orders: [], serverTime: "2026-10-22T00:00:00Z",
  summary: { totalQuantity: 0, registered: 0, pendingPayment: 0, paid: 0, pickedUp: 0, failed: 0, refund: 0 }, capabilities: {},
})) } }));

beforeEach(() => localStorage.clear());

it("shows an unfinished device offer in the catalog draft list", async () => {
  localStorage.setItem("wesup:offer:supplier-test:draft:local-one", JSON.stringify({
    id: "", revision: null, step: 2, updatedAt: 1, draft: { title: "Beras perangkat" },
    schedule: { openingMode: "immediate", collectionDays: 1, pickupStartsAt: "", pickupEndsAt: "" },
  }));
  render(<OfferDraftList ownerId="supplier-test" />);
  expect(await screen.findByText("Beras perangkat")).toBeInTheDocument();
  expect(screen.getByText("Hanya di perangkat ini")).toBeInTheDocument();
});

it("returns from a batch detail to the catalog instead of the current batch", async () => {
  render(<SupplierBatchTransactionCenter batchId="batch-one" />);
  expect(await screen.findByRole("link", { name: /Kembali ke katalog/ })).toHaveAttribute("href", "/supplier/catalog");
});
