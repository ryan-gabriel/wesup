import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createSnapTransaction,
  getTransactionStatus,
  MidtransProviderError,
} from "@/lib/payments/midtrans";

const env = {
  MIDTRANS_SERVER_KEY: "sandbox-key",
  MIDTRANS_IS_PRODUCTION: "false",
} as unknown as NodeJS.ProcessEnv;

describe("Midtrans Snap adapter", () => {
  beforeEach(() => vi.restoreAllMocks());
  it.each([404,401,500])("honors provider error %s inside an HTTP 200 response", async code => {
    vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({status_code:String(code),status_message:"Transaction status unavailable"}),{status:200}));
    await expect(getTransactionStatus("WESUP-absent",env)).rejects.toMatchObject({status:code>=500?502:code,fromProvider:true});
  });

  it("creates a sandbox Snap token without restricting active payment methods", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "snap-token-1",
          redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/token-1",
        }),
        { status: 201 },
      ),
    );

    const result = await createSnapTransaction(
      {
        orderId: "WESUP-abc123-1",
        grossAmount: 2800000,
        itemName: "Kentang Granola Segar",
        itemQuantity: 80,
        itemUnitPrice: 35000,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        finishUrl: "http://localhost:3000/pesanan/order-1/bayar",
      },
      env,
    );

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String((init as RequestInit).body));
    expect(url).toBe("https://app.sandbox.midtrans.com/snap/v1/transactions");
    expect(payload.transaction_details).toEqual({
      order_id: "WESUP-abc123-1",
      gross_amount: 2800000,
    });
    expect(payload.item_details).toEqual([
      { id: "WESUP-abc123-1", price: 35000, quantity: 80, name: "Kentang Granola Segar" },
    ]);
    expect(payload.enabled_payments).toBeUndefined();
    expect(payload.expiry.unit).toBe("minute");
    expect(payload.callbacks.finish).toBe("http://localhost:3000/pesanan/order-1/bayar");
    expect(result).toMatchObject({
      token: "snap-token-1",
      redirectUrl: "https://app.sandbox.midtrans.com/snap/v2/vtweb/token-1",
    });
  });

  it("rejects Snap creation when the remaining expiry is below five minutes", async () => {
    await expect(
      createSnapTransaction(
        {
          orderId: "WESUP-abc123-1",
          grossAmount: 10000,
          itemName: "Produk",
          itemQuantity: 1,
          itemUnitPrice: 10000,
          expiresAt: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
        },
        env,
      ),
    ).rejects.toMatchObject({ status: 403, retryable: false });
  });

  it("exposes a non-retryable 404 for Snap transactions with no selected method yet", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status_message: "Payment not found" }), { status: 404 }),
    );

    await expect(getTransactionStatus("WESUP-abc123-1", env)).rejects.toBeInstanceOf(MidtransProviderError);
    await expect(getTransactionStatus("WESUP-abc123-1", env)).rejects.toMatchObject({ status: 404, retryable: false });
  });
});
