import "server-only";

export type MidtransTransactionStatus = "pending" | "settlement" | "capture" | "expire" | "deny" | "cancel" | "refund" | "partial_refund" | "authorize" | string;

export interface MidtransChargeResult {
  orderId: string;
  transactionId: string | null;
  transactionStatus: MidtransTransactionStatus;
  qrCodeUrl: string | null;
  expiresAt: string | null;
  raw: Record<string, unknown>;
}


export interface MidtransSnapTransactionInput {
  orderId: string;
  grossAmount: number;
  itemName: string;
  itemQuantity: number;
  itemUnitPrice: number;
  expiresAt: string;
  finishUrl?: string;
  idempotencyKey?: string;
}

export interface MidtransSnapTransactionResult {
  orderId: string;
  token: string;
  redirectUrl: string | null;
  expiresAt: string;
  raw: Record<string, unknown>;
}

export interface MidtransProviderDetails {
  fromProvider: boolean;
  providerMessage: string | null;
  errorMessages: string[];
  requestId: string | null;
  raw: Record<string, unknown> | null;
}

export class MidtransProviderError extends Error {

  readonly status: number;
  readonly retryable: boolean;
  readonly fromProvider: boolean;
  readonly providerMessage: string | null;
  readonly errorMessages: string[];
  readonly requestId: string | null;
  readonly raw: Record<string, unknown> | null;
  constructor(message: string, status = 502, retryable = true, details: Partial<MidtransProviderDetails> = {}) {
    super(message);
    this.name = "MidtransProviderError";
    this.status = status;
    this.retryable = retryable;
    this.fromProvider = details.fromProvider === true;
    this.providerMessage = details.providerMessage ?? null;
    this.errorMessages = details.errorMessages ?? [];
    this.requestId = details.requestId ?? null;
    this.raw = details.raw ?? null;
  }
}

interface MidtransConfig { serverKey: string; baseUrl: string; snapBaseUrl: string; timeoutMs: number }

function config(env: NodeJS.ProcessEnv = process.env): MidtransConfig {
  const serverKey = env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) throw new MidtransProviderError("Midtrans server configuration is missing", 503, false);
  const production = env.MIDTRANS_IS_PRODUCTION?.trim() || "false";
  if (production !== "true" && production !== "false") throw new MidtransProviderError("MIDTRANS_IS_PRODUCTION must be true or false", 503, false);
  const defaultBase = production === "true" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
  const baseUrl = (env.MIDTRANS_BASE_URL?.trim() || defaultBase).replace(/\/$/, "");
  const snapBaseUrl = (env.MIDTRANS_SNAP_BASE_URL?.trim() || (production === "true" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com")).replace(/\/$/, "");
  const timeoutMs = Math.min(15_000, Math.max(1_000, Number(env.MIDTRANS_TIMEOUT_MS ?? 8_000)));
  return { serverKey, baseUrl, snapBaseUrl, timeoutMs };
}

function authHeader(serverKey: string): string {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

async function request<T>(path: string, init: RequestInit = {}, env?: NodeJS.ProcessEnv, baseUrlOverride?: string): Promise<T> {
  const cfg = config(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const response = await fetch(`${baseUrlOverride ?? cfg.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: authHeader(cfg.serverKey),
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    // Midtrans status lookups may return HTTP 200 with an error in status_code.
    // Treat this as a provider error before interpreting it as invoice data.
    const embeddedCode = body && typeof body === "object" ? String(body.status_code ?? "") : "";
    const effectiveStatus = response.ok && /^[45]\d\d$/.test(embeddedCode) ? Number(embeddedCode) : response.status;
    if (!response.ok || effectiveStatus >= 400) {
      const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
      const errorMessages = Array.isArray(record.error_messages)
        ? record.error_messages.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [];
      const statusMessage = typeof record.status_message === "string" && record.status_message.trim().length > 0 ? record.status_message.trim() : "";
      const providerMessage = errorMessages[0] ?? (statusMessage || null);
      const requestId = typeof record.request_id === "string" && record.request_id.trim().length > 0 ? record.request_id : null;
      const message = providerMessage ?? `Midtrans returned HTTP ${response.status}`;
      throw new MidtransProviderError(message, effectiveStatus >= 500 ? 502 : effectiveStatus, effectiveStatus >= 500 || effectiveStatus === 429, {
        fromProvider: true,
        providerMessage,
        errorMessages,
        requestId,
        raw: record,
      });
    }
    return body as T;
  } catch (error) {
    if (error instanceof MidtransProviderError) throw error;
    throw new MidtransProviderError(error instanceof Error && error.name === "AbortError" ? "Midtrans request timed out" : "Midtrans request failed", 502, true);
  } finally {
    clearTimeout(timeout);
  }
}

function qrUrl(body: Record<string, unknown>): string | null {
  const actions = Array.isArray(body.actions) ? body.actions : [];
  const action = actions.find((entry) => entry && typeof entry === "object" && (entry as Record<string, unknown>).name === "generate-qr-code-v2") as Record<string, unknown> | undefined;
  const url = action?.url;
  return typeof url === "string" ? url : null;
}


function formatMidtransTimestamp(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} +0700`;
}

function snapExpiry(expiresAt: string): { duration: number; unit: "minute" } {
  const expires = Date.parse(expiresAt);
  const remainingMinutes = Math.floor((expires - Date.now()) / 60_000);
  if (!Number.isFinite(expires) || remainingMinutes < 5) {
    throw new MidtransProviderError("Snap checkout requires at least five minutes before payment cutoff", 403, false);
  }
  return { duration: remainingMinutes, unit: "minute" };
}

export async function createSnapTransaction(input: MidtransSnapTransactionInput, env?: NodeJS.ProcessEnv): Promise<MidtransSnapTransactionResult> {
  if (!input.orderId.trim() || input.orderId.length > 50) throw new MidtransProviderError("Invalid Snap order id", 400, false);
  if (!Number.isSafeInteger(input.grossAmount) || input.grossAmount <= 0) throw new MidtransProviderError("Invalid gross amount", 400, false);
  if (!Number.isSafeInteger(input.itemQuantity) || input.itemQuantity <= 0) throw new MidtransProviderError("Invalid item quantity", 400, false);
  if (!Number.isSafeInteger(input.itemUnitPrice) || input.itemUnitPrice <= 0 || input.itemUnitPrice * input.itemQuantity !== input.grossAmount) {
    throw new MidtransProviderError("Item details do not match gross amount", 400, false);
  }
  const expiry = snapExpiry(input.expiresAt);
  const itemName = input.itemName.trim().slice(0, 50) || "Wesup order";
  const payload: Record<string, unknown> = {
    transaction_details: { order_id: input.orderId, gross_amount: input.grossAmount },
    item_details: [{ id: input.orderId, price: input.itemUnitPrice, quantity: input.itemQuantity, name: itemName }],
    expiry: { start_time: formatMidtransTimestamp(new Date()), duration: expiry.duration, unit: expiry.unit },
  };
  if (input.finishUrl) {
    payload.callbacks = { finish: input.finishUrl, unfinish: input.finishUrl, error: input.finishUrl };
  }
  const body = await request<Record<string, unknown>>("/snap/v1/transactions", {
    method: "POST",
    ...(input.idempotencyKey ? { headers: { "Idempotency-Key": input.idempotencyKey } } : {}),
    body: JSON.stringify(payload),
  }, env, config(env).snapBaseUrl);
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) throw new MidtransProviderError("Midtrans did not return a Snap token", 502, true);
  return {
    orderId: String(body.order_id ?? input.orderId),
    token,
    redirectUrl: typeof body.redirect_url === "string" ? body.redirect_url : null,
    expiresAt: input.expiresAt,
    raw: body,
  };
}

export async function chargeQris(input: { orderId: string; grossAmount: number; idempotencyKey: string; expiresAt?: string | null }, env?: NodeJS.ProcessEnv): Promise<MidtransChargeResult> {
  if (!Number.isSafeInteger(input.grossAmount) || input.grossAmount <= 0) throw new MidtransProviderError("Invalid gross amount", 400, false);
  const customExpiry = input.expiresAt ? Math.ceil((Date.parse(input.expiresAt) - Date.now()) / 1000) : null;
  if (customExpiry !== null && (!Number.isFinite(customExpiry) || customExpiry <= 0)) throw new MidtransProviderError("Payment window has expired", 403, false);
  const payload: Record<string, unknown> = { payment_type: "qris", transaction_details: { order_id: input.orderId, gross_amount: input.grossAmount }, qris: { acquirer: "gopay" } };
  if (customExpiry !== null) payload.custom_expiry = { expiry_duration: customExpiry, unit: "second" };
  const body = await request<Record<string, unknown>>("/v2/charge", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify(payload),
  }, env);
  return { orderId: String(body.order_id ?? input.orderId), transactionId: typeof body.transaction_id === "string" ? body.transaction_id : null, transactionStatus: String(body.transaction_status ?? "pending"), qrCodeUrl: qrUrl(body), expiresAt: typeof body.expiry_time === "string" ? body.expiry_time : null, raw: body };
}

export async function expireTransaction(orderId: string, env?: NodeJS.ProcessEnv): Promise<MidtransChargeResult> {
  if (!orderId.trim()) throw new MidtransProviderError("Invalid order id", 400, false);
  const body = await request<Record<string, unknown>>(`/v2/${encodeURIComponent(orderId)}/expire`, { method: "POST" }, env);
  return { orderId: String(body.order_id ?? orderId), transactionId: typeof body.transaction_id === "string" ? body.transaction_id : null, transactionStatus: String(body.transaction_status ?? "expire"), qrCodeUrl: qrUrl(body), expiresAt: typeof body.expiry_time === "string" ? body.expiry_time : null, raw: body };
}

export async function getTransactionStatus(orderId: string, env?: NodeJS.ProcessEnv): Promise<MidtransChargeResult> {
  const body = await request<Record<string, unknown>>(`/v2/${encodeURIComponent(orderId)}/status`, { method: "GET" }, env);
  return { orderId: String(body.order_id ?? orderId), transactionId: typeof body.transaction_id === "string" ? body.transaction_id : null, transactionStatus: String(body.transaction_status ?? "pending"), qrCodeUrl: qrUrl(body), expiresAt: typeof body.expiry_time === "string" ? body.expiry_time : null, raw: body };
}

export function isSuccessfulTransaction(status: string): boolean {
  return status === "settlement" || status === "capture";
}

export function isExpiredTransaction(status: string): boolean {
  return status === "expire" || status === "deny" || status === "cancel";
}
