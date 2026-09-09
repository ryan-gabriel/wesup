// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderComponent as render } from "./test-utils";
import CreateCatalogForm from "@/components/supplier/catalog/CreateCatalogForm";
import type { CatalogDraft } from "@/lib/supplier-catalog/types";

const { create, update, push } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/supplier-catalog/api-repository", () => ({
  supplierCatalogApiRepository: { create, update },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const DRAFT: CatalogDraft = {
  title: "Beras Bandung",
  category: "Makanan Siap Saji",
  description: "Beras untuk kebutuhan UMKM.",
  targetQuantity: 50,
  productPhoto: null,
  productPhotoUrl: "https://woxgghuoeljagnkldqtf.supabase.co/storage/v1/object/public/wesup-public/products/batch/photo.webp",
  tiers: [
    { tierNumber: 1, minimumQuantity: 1, maximumQuantity: 24, pricePerUnit: 75000 },
    { tierNumber: 2, minimumQuantity: 25, maximumQuantity: null, pricePerUnit: 68000 },
  ],
  registrationOpensAt: "2099-01-01T01:00",
  registrationClosesAt: "2099-01-02T01:00",
  paymentOpensAt: "2099-01-02T02:00",
  paymentClosesAt: "2099-01-03T02:00",
  estimatedReadyAt: "2099-01-04T02:00",
  pickupName: "Gudang Bandung",
  pickupAddress: "Jl. Asia Afrika, Bandung",
  pickupLatitude: -6.9175,
  pickupLongitude: 107.6191,
  recurring: { enabled: false, name: "", intervalDays: 7, daysOfWeek: [] },
};

async function goToReview(user: ReturnType<typeof userEvent.setup>) {
  for (let step = 1; step < 5; step += 1) {
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
  }
  expect(screen.getByRole("heading", { name: "Tinjauan Penawaran" })).toBeInTheDocument();
}

describe("CreateCatalogForm success flow", () => {
  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    create.mockReset().mockResolvedValue({ item: { id: "new-batch" } });
    update.mockReset().mockResolvedValue({ item: { id: "existing-batch" } });
    push.mockReset();
  });

  it("uses the actual draft action and shows the draft modal", async () => {
    const user = userEvent.setup();
    render(<CreateCatalogForm initialDraft={DRAFT} />);
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Simpan Draft" }));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Draft berhasil disimpan" })).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith(DRAFT, "draft", expect.any(Object));
    expect(screen.queryByText("Perubahan berhasil disimpan!")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lihat Katalog Saya" }));
    expect(push).toHaveBeenCalledWith("/supplier/catalog");
  });

  it("shows published copy for a create publish", async () => {
    const user = userEvent.setup();
    render(<CreateCatalogForm initialDraft={DRAFT} />);
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Terbitkan Penawaran" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Penawaran berhasil diterbitkan" })).toBeInTheDocument());
    expect(create).toHaveBeenCalledWith(DRAFT, "publish", expect.any(Object));
  });

  it("shows updated copy for editing a published batch", async () => {
    const user = userEvent.setup();
    render(<CreateCatalogForm initialDraft={DRAFT} batchId="existing-batch" submitAction="draft" submitLabel="Simpan Perubahan" productPhotoRequired={false} />);
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Perubahan berhasil disimpan" })).toBeInTheDocument());
    expect(update).toHaveBeenCalledWith("existing-batch", DRAFT, "draft", expect.any(Object));
  });

  it("keeps the form alert and does not open the modal when saving fails", async () => {
    const user = userEvent.setup();
    create.mockRejectedValueOnce(new Error("Gagal menyimpan katalog"));
    render(<CreateCatalogForm initialDraft={DRAFT} />);
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: "Simpan Draft" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Gagal menyimpan katalog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
