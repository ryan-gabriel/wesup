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
    expect(screen.getByRole("link", { name: /lihat pesanan/i })).toHaveAttribute("href", "/umkm/pesanan");
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

describe("JoinBatchForm duplicate registration", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const conflictBody = {
    error: "Anda sudah terdaftar pada batch ini.",
    code: "REGISTRATION_ALREADY_EXISTS",
    details: { registrationId: "reg-existing", quantity: 5, canWithdraw: true },
  };

  it("shows an existing registration on load instead of the join form", () => {
    render(
      <JoinBatchForm
        item={ITEM}
        consentGiven
        initialRegistration={{ registrationId: "reg-existing", quantity: 5, canWithdraw: true }}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText(/sudah terdaftar/i)).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /jumlah porsi/i })).toHaveValue(5);
    expect(screen.getByRole("link", { name: /buka pesanan saya/i })).toHaveAttribute(
      "href",
      "/umkm/pesanan/reg-existing",
    );
    expect(screen.queryByRole("button", { name: /daftar sekarang/i })).not.toBeInTheDocument();
  });

  it("reports the existing registration instead of a false success", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(conflictBody), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );
    render(<JoinBatchForm item={ITEM} consentGiven onSuccess={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /daftar sekarang/i }));

    expect(await screen.findByText(/sudah terdaftar/i)).toBeInTheDocument();
    expect(screen.queryByText(/pendaftaran berhasil/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /buka pesanan saya/i })).toHaveAttribute(
      "href",
      "/umkm/pesanan/reg-existing",
    );
    expect(
      screen.getByRole("button", { name: /batalkan & daftar ulang/i }),
    ).toBeEnabled();
  });

  it("withdraws the existing registration and joins again with the new quantity", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/withdraw")) {
        return new Response(JSON.stringify({ item: { id: "reg-existing" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const calls = fetchMock.mock.calls.filter(
        (call) => String(call[0]) === "/api/registrations",
      ).length;
      if (calls === 1) {
        return new Response(JSON.stringify(conflictBody), {
          status: 409,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ ok: true, count: 12, registrationId: "reg-new" }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    });
    render(<JoinBatchForm item={ITEM} consentGiven onSuccess={onSuccess} />);

    await user.click(screen.getByRole("button", { name: /daftar sekarang/i }));
    await screen.findByText(/sudah terdaftar/i);

    const quantity = screen.getByRole("spinbutton", { name: /jumlah porsi/i });
    await user.clear(quantity);
    await user.type(quantity, "7");
    await user.click(
      screen.getByRole("button", { name: /batalkan & daftar ulang/i }),
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalledWith({ count: 12, registrationId: "reg-new" });
    expect(await screen.findByText(/pendaftaran berhasil/i)).toBeInTheDocument();

    const registrationCalls = fetchMock.mock.calls.filter(
      (call) => String(call[0]) === "/api/registrations",
    );
    expect(registrationCalls).toHaveLength(2);
    expect(String(registrationCalls[1]?.[1]?.body)).toContain('"quantity":7');
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes("/withdraw")),
    ).toBe(true);
  });

  it("keeps a locked registration as an error without a withdraw action", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ...conflictBody,
          details: { registrationId: "reg-locked", quantity: 5, canWithdraw: false },
        }),
        { status: 409, headers: { "content-type": "application/json" } },
      ),
    );
    render(<JoinBatchForm item={ITEM} consentGiven onSuccess={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /daftar sekarang/i }));

    expect(await screen.findByText(/Anda sudah terdaftar pada batch ini/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /batalkan & daftar ulang/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /buka pesanan saya/i })).toBeInTheDocument();
  });
});

const POLICY_V2_ITEM: MarketplaceItem = {
  ...ITEM,
  policyVersion: 2,
  unit: "pcs",
  paymentOpeningPolicy: "fixed_cutoff",
  paymentOpensAt: "2026-09-16T10:00:00.000Z",
  paymentClosesAt: "2026-09-17T10:00:00.000Z",
  pickupStartsAt: "2026-09-18T10:00:00.000Z",
  pickupEndsAt: "2026-09-19T10:00:00.000Z",
};

describe("JoinBatchForm terms gate", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the submit button as visibly disabled until the terms are accepted", async () => {
    const user = userEvent.setup();
    render(<JoinBatchForm item={POLICY_V2_ITEM} consentGiven onSuccess={vi.fn()} />);

    const button = screen.getByRole("button", { name: /konfirmasi ikut pesanan/i });
    expect(button).toBeDisabled();
    expect(button.className).toContain("cursor-not-allowed");
    expect(button.className).toContain("bg-wesup-paper-sub");
    expect(button.className).toContain("text-wesup-ink/40");
    expect(button.className).not.toContain("bg-wesup-ink");
    expect(
      screen.getByText(/centang persetujuan syarat di atas/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox"));

    expect(button).toBeEnabled();
    expect(button.className).toContain("bg-wesup-ink");
    expect(button.className).not.toContain("cursor-not-allowed");
  });

  it("re-disables the button when the quantity changes and resets the terms", async () => {
    const user = userEvent.setup();
    render(<JoinBatchForm item={POLICY_V2_ITEM} consentGiven onSuccess={vi.fn()} />);

    await user.click(screen.getByRole("checkbox"));
    const button = screen.getByRole("button", { name: /konfirmasi ikut pesanan/i });
    expect(button).toBeEnabled();

    const quantity = screen.getByRole("spinbutton", { name: /jumlah/i });
    await user.clear(quantity);
    await user.type(quantity, "7");

    expect(button).toBeDisabled();
    expect(button.className).toContain("cursor-not-allowed");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });
});
