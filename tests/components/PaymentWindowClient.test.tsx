// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import PaymentWindowClient from "@/components/payments/PaymentWindowClient";
import { PAYMENT_INVOICE_MOCKS } from "@/lib/payments/mock-data";
import { renderComponent as render } from "./test-utils";

function mockById(id: string) {
  const invoice = PAYMENT_INVOICE_MOCKS.find((item) => item.id === id);
  if (!invoice) throw new Error(`mock invoice not found: ${id}`);
  return invoice;
}

describe("PaymentWindowClient (static gate states)", () => {
  it("renders the open gate: enabled QRIS pay button + countdown to deadline", () => {
    render(<PaymentWindowClient invoice={mockById("pay-open-001")} />);
    expect(
      screen.getByRole("button", { name: /bayar via qris/i }),
    ).toBeEnabled();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.getByText(/sisa waktu pembayaran/i)).toBeInTheDocument();
  });

  it("locks the button while waiting for the window to open", () => {
    render(<PaymentWindowClient invoice={mockById("pay-waiting-001")} />);
    expect(
      screen.getByRole("button", { name: /tunggu jendela pembayaran dibuka/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/menunggu jendela pembayaran dibuka/i),
    ).toBeInTheDocument();
  });

  it("shows the Hit & Run sanction banner when the window expired", () => {
    render(<PaymentWindowClient invoice={mockById("pay-expired-001")} />);
    expect(
      screen.getByRole("alert", { name: /peringatan sanksi hit and run/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /jendela pembayaran sudah ditutup/i }),
    ).toBeDisabled();
  });

  it("renders the paid state without any countdown", () => {
    render(<PaymentWindowClient invoice={mockById("pay-paid-001")} />);
    expect(
      screen.getByText(/pembayaran terkonfirmasi lunas/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /pembayaran lunas/i }),
    ).toBeDisabled();
  });

  it("always shows the locked-tier invoice summary", () => {
    render(<PaymentWindowClient invoice={mockById("pay-open-001")} />);
    expect(screen.getByText("Tagihan Final")).toBeInTheDocument();
    expect(screen.getAllByText(/Tier 2/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rp\s*760\.000/).length).toBeGreaterThan(0);
  });
});