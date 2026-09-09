import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  resolvePaymentOutcome,
  verifyMidtransSignature,
  type MidtransNotification,
} from "@/lib/payments/midtrans";

// J1 — callback settlement valid → paid; J2 — palsu/mismatch ditolak

const SERVER_KEY = "Mid-server-test-key-123";

function signed(
  overrides: Partial<MidtransNotification> = {},
): MidtransNotification {
  const base = {
    order_id: "WESUP-ABC123-1700000000000",
    status_code: "200",
    gross_amount: "50000.00",
    transaction_status: "settlement",
    transaction_id: "trx-001",
    fraud_status: "accept",
    payment_type: "qris",
    ...overrides,
  };
  const raw = `${base.order_id}${base.status_code}${base.gross_amount}${SERVER_KEY}`;
  return {
    ...base,
    signature_key: createHash("sha512").update(raw).digest("hex"),
  };
}

describe("verifyMidtransSignature", () => {
  it("accepts a genuine Midtrans signature (SHA512 order+code+amount+key)", () => {
    expect(verifyMidtransSignature(signed(), SERVER_KEY)).toBe(true);
  });

  it("rejects a tampered gross_amount", () => {
    const n = signed();
    expect(
      verifyMidtransSignature({ ...n, gross_amount: "1.00" }, SERVER_KEY),
    ).toBe(false);
  });

  it("rejects a wrong server key", () => {
    expect(verifyMidtransSignature(signed(), "wrong-key")).toBe(false);
  });

  it("rejects malformed signatures without throwing", () => {
    const n = signed();
    expect(verifyMidtransSignature({ ...n, signature_key: "zzz" }, SERVER_KEY)).toBe(false);
    expect(
      verifyMidtransSignature({ ...n, signature_key: "" }, SERVER_KEY),
    ).toBe(false);
  });
});

describe("resolvePaymentOutcome", () => {
  it("maps settlement → paid", () => {
    expect(resolvePaymentOutcome(signed()).outcome).toBe("paid");
  });

  it("maps capture+accept → paid, capture+challenge → pending", () => {
    expect(
      resolvePaymentOutcome(signed({ transaction_status: "capture", fraud_status: "accept" }))
        .outcome,
    ).toBe("paid");
    expect(
      resolvePaymentOutcome(
        signed({ transaction_status: "capture", fraud_status: "challenge" }),
      ).outcome,
    ).toBe("pending");
  });

  it("maps expire → expired, cancel/deny/failure → failed", () => {
    expect(resolvePaymentOutcome(signed({ transaction_status: "expire" })).outcome).toBe(
      "expired",
    );
    for (const s of ["cancel", "deny", "failure"]) {
      expect(resolvePaymentOutcome(signed({ transaction_status: s })).outcome).toBe(
        "failed",
      );
    }
  });

  it("maps pending and unknown statuses → pending (log only)", () => {
    expect(resolvePaymentOutcome(signed({ transaction_status: "pending" })).outcome).toBe(
      "pending",
    );
    expect(
      resolvePaymentOutcome(signed({ transaction_status: "authorize" })).outcome,
    ).toBe("pending");
  });
});
