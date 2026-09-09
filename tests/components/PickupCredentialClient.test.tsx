// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import PickupCredentialClient from "@/components/orders/PickupCredentialClient";
import { PICKUP_CREDENTIAL_MOCKS } from "@/lib/orders/pickup-credential-mock";
import type { PickupCredential } from "@/lib/orders/types";
import { renderComponent as render } from "./test-utils";

function mockByOrderId(orderId: string): PickupCredential {
  const credential = PICKUP_CREDENTIAL_MOCKS.find(
    (item) => item.orderId === orderId,
  );
  if (!credential) throw new Error(`mock credential not found: ${orderId}`);
  return credential;
}

describe("PickupCredentialClient (static status gate)", () => {
  it("renders QR + PIN for a paid order, and never before payment", () => {
    render(
      <PickupCredentialClient credential={mockByOrderId("ord-umkm-001")} />,
    );
    expect(
      screen.getByRole("heading", { name: /kode qr pengambilan/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("PIN 4 digit: 4 8 2 1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /salin pin/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Jl. Asia Afrika No. 123, Bandung")).toBeInTheDocument();
  });

  it("shows the waiting state for registered orders without credentials", () => {
    render(
      <PickupCredentialClient credential={mockByOrderId("ord-umkm-006")} />,
    );
    expect(
      screen.getByText(/menunggu jendela pembayaran dibuka/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/PIN 4 digit:/)).not.toBeInTheDocument();
  });

  it("prompts an unpaid order to pay before issuing credentials", () => {
    render(
      <PickupCredentialClient credential={mockByOrderId("ord-umkm-002")} />,
    );
    const payLink = screen.getByRole("link", { name: /bayar sekarang/i });
    expect(payLink).toHaveAttribute("href", "/pesanan/ord-umkm-002/bayar");
    expect(screen.queryByText(/PIN 4 digit:/)).not.toBeInTheDocument();
  });

  it("renders the picked-up terminal state", () => {
    render(
      <PickupCredentialClient credential={mockByOrderId("ord-umkm-003")} />,
    );
    expect(screen.getByText(/serah terima selesai/i)).toBeInTheDocument();
    expect(screen.queryByText(/PIN 4 digit:/)).not.toBeInTheDocument();
  });

  it("warns that funds are forfeited on no-show", () => {
    render(
      <PickupCredentialClient credential={mockByOrderId("ord-umkm-005")} />,
    );
    expect(
      screen.getByRole("heading", { name: /dana hangus/i }),
    ).toBeInTheDocument();
  });

  it("renders the cancelled state", () => {
    render(
      <PickupCredentialClient credential={mockByOrderId("ord-umkm-004")} />,
    );
    expect(screen.getByText(/pesanan dibatalkan/i)).toBeInTheDocument();
  });
});