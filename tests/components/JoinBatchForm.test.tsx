// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import JoinBatchForm from "@/components/marketplace/JoinBatchForm";
import { renderComponent as render } from "./test-utils";

const ITEM: MarketplaceItem = {
  id: "44444444-4444-4444-8444-444444444444",
  title: "Cabai Merah Premium",
  supplierName: "Supplier Bandung",
  category: "Sayur & Buah",
  imageUrl: "/file.svg",
  distanceKm: 2,
  estimatedPickupMinutes: 6,
  basePrice: 25000,
  currentTierPrice: 22000,
  registeredQuantity: 30,
  targetQuantity: 50,
  status: "ACTIVE",
  registrationClosesAt: "2026-09-15T10:00:00.000Z",
  pickupLatitude: -6.95,
  pickupLongitude: 107.7,
  pickupAddress: "Jl. Asia Afrika",
};

describe("JoinBatchForm", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires location consent before enabling submission", () => {
    render(<JoinBatchForm item={ITEM} consentGiven={false} onSuccess={vi.fn()} />);
    expect(screen.getByRole("spinbutton", { name: /jumlah porsi/i })).toHaveValue(1);
    expect(screen.getByRole("button", { name: /daftar sekarang/i })).toBeDisabled();
    expect(screen.getByText(/centang persetujuan lokasi/i)).toBeInTheDocument();
  });

  it("posts quantity and optional consent coordinates, then shows success state", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, count: 35, registrationId: "reg-1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    render(
      <JoinBatchForm
        item={ITEM}
        consentGiven
        viewerLocation={{ latitude: -6.91, longitude: 107.61 }}
        onSuccess={onSuccess}
      />,
    );

    const quantity = screen.getByRole("spinbutton", { name: /jumlah porsi/i });
    await user.clear(quantity);
    await user.type(quantity, "5");
    await user.click(screen.getByRole("button", { name: /daftar sekarang/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/registrations", expect.objectContaining({
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        batchId: ITEM.id,
        quantity: 5,
        consentLat: -6.91,
        consentLng: 107.61,
      }),
    }));
    expect(onSuccess).toHaveBeenCalledWith({ count: 35, registrationId: "reg-1" });
    expect(await screen.findByText(/pendaftaran berhasil/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /lihat pesanan/i })).toHaveAttribute("href", "/pesanan");
  });

  it("keeps the form usable and exposes duplicate/closed API errors", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Anda sudah terdaftar pada penawaran ini" }), { status: 409 }),
    );
    render(<JoinBatchForm item={ITEM} consentGiven onSuccess={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /daftar sekarang/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/sudah terdaftar/i);
    expect(screen.getByRole("button", { name: /daftar sekarang/i })).toBeEnabled();
  });

  it("shows a retryable network error", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new Error("Network down"));
    render(<JoinBatchForm item={ITEM} consentGiven onSuccess={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /daftar sekarang/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/network down/i);
  });
});
