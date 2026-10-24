import type { OpenAPIV3 } from "openapi-types";

export const schemas: OpenAPIV3.ComponentsObject["schemas"] = {
  ErrorResponse: {
    type: "object",
    required: ["error"],
    properties: {
      error: { type: "string", example: "Permintaan tidak dapat diproses." },
      code: { type: "string", example: "VALIDATION_ERROR" },
      details: { type: "object", additionalProperties: true },
      requestId: { type: "string", format: "uuid" },
    },
  },
  OkResponse: {
    type: "object",
    required: ["ok"],
    properties: { ok: { type: "boolean", example: true } },
  },
  Pagination: {
    type: "object",
    properties: {
      nextCursor: { type: "string", nullable: true, example: "20" },
      serverTime: { type: "string", format: "date-time" },
    },
  },
  Batch: {
    type: "object",
    description: "Representasi batch katalog Supplier.",
    additionalProperties: true,
    properties: {
      id: { type: "string", format: "uuid" },
      title: { type: "string", example: "Kentang Granola Segar" },
      status: { type: "string", example: "published" },
      unit: { type: "string", example: "kg" },
      capacityQuantity: { type: "integer", minimum: 1 },
      registeredQuantity: { type: "integer", minimum: 0 },
    },
  },
  MarketplaceAvailability: {
    type: "object",
    required: ["canRegister", "reason", "remainingQuantity"],
    properties: {
      canRegister: { type: "boolean" },
      reason: { type: "string", nullable: true, enum: ["not_open", "expired", "full", "closed", null] },
      remainingQuantity: { type: "integer", nullable: true, minimum: 0 },
    },
  },
  MarketplaceOffer: {
    allOf: [{ $ref: "#/components/schemas/Batch" }, {
      type: "object",
      properties: {
        availability: { $ref: "#/components/schemas/MarketplaceAvailability" },
        registrationOpensAt: { type: "string", format: "date-time" },
        registrationClosesAt: { type: "string", format: "date-time" },
        serverTime: { type: "string", format: "date-time" },
      },
    }],
    description: "Snapshot penawaran publik. Batch tertutup tetap menjelaskan alasan tanpa mengizinkan pendaftaran.",
  },
  Order: {
    type: "object",
    description: "Ringkasan order UMKM/Supplier; field tambahan dapat berubah sesuai read model.",
    additionalProperties: true,
    properties: {
      id: { type: "string", format: "uuid" },
      status: { type: "string", example: "pending_payment" },
      quantity: { type: "integer", minimum: 1 },
      total: { type: "integer", minimum: 0, example: 1440000 },
      serverTime: { type: "string", format: "date-time", description: "Waktu absolut server — sumber countdown, bukan jam perangkat." },
    },
  },
  OrderDetail: {
    allOf: [{ $ref: "#/components/schemas/Order" }],
    description: "Snapshot lengkap order, invoice, payment attempt, pickup, escrow, dispute, rating, dan capability.",
    properties: { paymentDemo: { type: "object", properties: { enabled: { type: "boolean" }, canSimulatePaid: { type: "boolean" }, blockedReason: { type: "string", nullable: true }, checkoutReference: { type: "string", nullable: true } } } },
  },
  PaymentAttempt: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      providerOrderId: { type: "string" },
      checkoutMode: { type: "string", enum: ["snap", "core_qris"] },
      snapToken: { type: "string", nullable: true },
      redirectUrl: { type: "string", format: "uri", nullable: true },
      qrCodeUrl: { type: "string", format: "uri", nullable: true },
      expiresAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  Notification: {
    type: "object",
    additionalProperties: true,
    properties: {
      id: { type: "string", format: "uuid" },
      type: { type: "string" },
      title: { type: "string" },
      message: { type: "string" },
      readAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  SupplierFinance: {
    type: "object",
    additionalProperties: true,
    properties: {
      escrow: { type: "integer", minimum: 0 },
      frozen: { type: "integer", minimum: 0 },
      available: { type: "integer", minimum: 0 },
      paidOut: { type: "integer", minimum: 0 },
    },
  },
};

export const ref = (name: string): OpenAPIV3.ReferenceObject => ({
  $ref: `#/components/schemas/${name}`,
});
