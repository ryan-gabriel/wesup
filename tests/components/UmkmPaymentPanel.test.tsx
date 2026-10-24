// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UmkmPaymentPanel from "@/components/payments/UmkmPaymentPanel";
import type { UmkmOrderDetail } from "@/lib/orders/api-types";
import { renderComponent as render } from "./test-utils";

vi.mock("@/components/payments/MidtransSnapLoader", () => ({
  __esModule: true,
  default: ({ onStateChange }: { onStateChange: (state: "ready") => void }) => {
    onStateChange("ready");
    return null;
  },
}));

const baseOrder = {
  id: "11111111-1111-4111-8111-111111111111",
  batchId: "22222222-2222-4222-8222-222222222222",
  batchTitle: "Kentang Granola",
  batchDisplayCode: "BATCH-22222222",
  supplierName: "PT Agri Sejahtera",
  batchStatus: "closed",
  quantity: 80,
  unit: "kg",
  status: "pending_payment",
  phase: "payment_open",
  finalAmount: 2800000,
  lockedTier: 3,
  createdAt: "2026-09-15T00:00:00.000Z",
  timeline: {
    registrationClosesAt: "2026-09-15T00:00:00.000Z",
    paymentOpensAt: "2026-09-16T00:00:00.000Z",
    paymentClosesAt: "2026-09-17T00:00:00.000Z",
    estimatedReadyAt: "2026-09-18T00:00:00.000Z",
    pickupDeadlineAt: "2026-09-18T12:00:00.000Z",
    complaintDeadlineAt: null,
  },
  capabilities: { canPay: true, canViewPickup: false, canComplain: false, canTrackDispute: false, canRate: false, canSubmitRefundAccount: false },
  paymentStatus: "pending",
  pickupConfirmedAt: null,
  invoice: { paymentId: "pay-1", grossAmount: 2800000, status: "pending", midtransOrderId: "WESUP-1", qrCodeUrl: null, qrCodeExpiresAt: null, paidAt: null },
  pickup: null,
  escrow: null,
  dispute: null,
  rating: null,
  refund: null,
  serverTime: "2026-09-16T01:00:00.000Z",
} satisfies Omit<UmkmOrderDetail, "paymentAttempt">;

describe("UmkmPaymentPanel", () => {
  it("shows a separate sandbox settlement action only for eligible demo users", () => {
    const order={...baseOrder,paymentAttempt:null,paymentDemo:{enabled:true,canSimulatePaid:false,blockedReason:"Buat checkout pembayaran terlebih dahulu.",checkoutReference:null}};
    const view=render(<UmkmPaymentPanel order={order} onReload={vi.fn()} />);
    expect(screen.getByRole("button",{name:"Pembayaran lunas"})).toBeDisabled();
    expect(screen.getByText("Simulasi pembayaran · Sandbox")).toBeInTheDocument();
    view.rerender(<UmkmPaymentPanel order={{...order,paymentDemo:{...order.paymentDemo,enabled:false}}} onReload={vi.fn()} />);
    expect(screen.queryByRole("button",{name:"Pembayaran lunas"})).not.toBeInTheDocument();
  });
  it("shows the real payment closing date while counting down to opening", () => {
    render(<UmkmPaymentPanel order={{...baseOrder, invoice:null, paymentAttempt:null,phase:"waiting_payment_window",serverTime:"2026-09-15T00:00:00Z"}} onReload={vi.fn()} />);
    expect(screen.getByText(/Batas akhir:/)).toHaveTextContent("17 Sep 2026");
    expect(screen.getByText(/^Buka:/)).toHaveTextContent("16 Sep 2026");
  });

  it("keeps the four-check budget across refreshed props, then permits a manual check", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(baseOrder.serverTime));
    const fetcher = vi.fn(async () => ({ok:true,json:async()=>({status:"pending",localStatus:"pending_payment",attemptStatus:"pending"})}));
    vi.stubGlobal("fetch",fetcher);
    const order = {...baseOrder,paymentAttempt:{id:"attempt-budget",providerOrderId:"WESUP-1",status:"pending" as const,checkoutMode:"snap" as const,providerStatus:"pending",paymentMethod:"qris",qrCodeUrl:null,expiresAt:"2026-09-17T00:00:00Z"}};
    const onReload=vi.fn();
    try {
      const view=render(<UmkmPaymentPanel order={order} onReload={onReload} />);
      for(let i=0;i<4;i++) {
        await act(async()=>{await vi.advanceTimersByTimeAsync(15_000);});
        view.rerender(<UmkmPaymentPanel order={{...order,serverTime:new Date().toISOString(),paymentAttempt:{...order.paymentAttempt}}} onReload={onReload} />);
        await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
      }
      expect(fetcher).toHaveBeenCalledTimes(4);
      await act(async()=>{await vi.advanceTimersByTimeAsync(60_000);});
      expect(fetcher).toHaveBeenCalledTimes(4);
      await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Cek status pembayaran"}));});
      expect(fetcher).toHaveBeenCalledTimes(5);
    } finally {vi.useRealTimers();vi.unstubAllGlobals();}
  });
  it("keeps a real provider-check action visible after the deadline", () => {
    render(<UmkmPaymentPanel order={{ ...baseOrder, phase: "payment_verifying", serverTime: "2026-09-18T01:00:00Z", capabilities: {...baseOrder.capabilities,canPay:false}, paymentAttempt: { id: "attempt", providerOrderId: "WESUP-1", status: "pending", checkoutMode: "snap", providerStatus: "pending", paymentMethod: "bank_transfer", qrCodeUrl: null, expiresAt: "2026-09-17T00:00:00Z" } }} onReload={vi.fn()} />);
    expect(screen.getByRole("button",{name:"Cek status pembayaran"})).toBeInTheDocument();
    expect(screen.queryByText("Memeriksa status pembayaran…")).not.toBeInTheDocument();
  });
  it("explains that a created checkout still needs a method", () => {
    render(<UmkmPaymentPanel order={{ ...baseOrder, paymentAttempt: { id: "attempt-1", providerOrderId: "WESUP-1", status: "pending", checkoutMode: "snap", providerStatus: "pending", paymentMethod: null, qrCodeUrl: null, expiresAt: "2026-09-17T00:00:00.000Z" } }} onReload={vi.fn()} snapConfig={{ clientKey: "client", scriptUrl: "https://example.test/snap.js", nonce: null }} />);
    expect(screen.getByText("Checkout sudah dibuat")).toBeInTheDocument();
    expect(screen.getByText(/metode pembayaran belum selesai dipilih/i)).toBeInTheDocument();
    expect(screen.queryByText(/Status provider/i)).not.toBeInTheDocument();
  });

  it("shows a friendly confirmed method only when payment_type exists", () => {
    render(<UmkmPaymentPanel order={{ ...baseOrder, paymentAttempt: { id: "attempt-1", providerOrderId: "WESUP-1", status: "pending", checkoutMode: "snap", providerStatus: "pending", paymentMethod: "qris", qrCodeUrl: null, expiresAt: "2026-09-17T00:00:00.000Z" } }} onReload={vi.fn()} snapConfig={{ clientKey: "client", scriptUrl: "https://example.test/snap.js", nonce: null }} />);
    expect(screen.getByText("Menunggu pembayaran")).toBeInTheDocument();
    expect(screen.getByText("Metode dipilih: QRIS")).toBeInTheDocument();
  });
  it("refreshes once when the waiting window reaches its opening", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T01:00:00.000Z"));
    const onReload = vi.fn();
    try {
      render(<UmkmPaymentPanel order={{ ...baseOrder, phase: "waiting_payment_window", paymentAttempt: null }} onReload={onReload} />);
      act(() => { vi.advanceTimersByTime(1); });
      expect(onReload).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not reload a terminal expired payment page", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T01:00:00.000Z"));
    const onReload = vi.fn();
    try {
      render(<UmkmPaymentPanel order={{ ...baseOrder, phase: "payment_expired", paymentAttempt: null }} onReload={onReload} />);
      act(() => { vi.advanceTimersByTime(1); });
      expect(onReload).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the provider rejection reason and stops offering a retry", async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      json: async () => ({
        error: "Pembayaran ditolak provider pembayaran.",
        code: "PAYMENT_PROVIDER_REJECTED",
        requestId: "req-9",
        details: { providerMessage: "Transaction amount is not equal to the expected total." },
      }),
    }));
    vi.stubGlobal("fetch", fetcher);
    try {
      render(<UmkmPaymentPanel order={{ ...baseOrder, paymentAttempt: null }} onReload={vi.fn()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /bayar sekarang/i }));
      });
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/transaction amount is not equal to the expected total/i);
      expect(alert).toHaveTextContent(/req-9/);
      expect(screen.queryByRole("button", { name: /coba lagi/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /bayar sekarang/i })).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
