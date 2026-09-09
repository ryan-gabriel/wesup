export type BatchStatus =
  | "draft"
  | "published"
  | "closed"
  | "cancelled"
  | "takedown"
  | "completed";

export interface BatchTimeline {
  registration_opens_at: string;
  registration_closes_at: string;
  payment_opens_at: string;
  payment_closes_at: string;
  estimated_ready_at: string;
}

export interface Tier {
  tier_number: number;
  min_volume: number;
  max_volume: number | null;
  price_per_unit: number;
}

export interface RegistrationGateResult {
  allowed: boolean;
  reason?: "not_open" | "closed" | "not_published";
}

export type PaymentGateState = "waiting" | "open" | "expired";

export interface PaymentGateResult {
  allowed: boolean;
  reason?: "not_open" | "expired";
  state: PaymentGateState;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function evaluateRegistrationWindow(
  timeline: BatchTimeline,
  nowIso: string,
  batchStatus: BatchStatus,
): RegistrationGateResult {
  if (batchStatus !== "published") {
    return { allowed: false, reason: "not_published" };
  }

  const now = Date.parse(nowIso);
  const opens = Date.parse(timeline.registration_opens_at);
  const closes = Date.parse(timeline.registration_closes_at);

  if (now < opens) {
    return { allowed: false, reason: "not_open" };
  }
  if (now >= closes) {
    return { allowed: false, reason: "closed" };
  }
  return { allowed: true };
}

export function resolveTierForVolume(
  tiers: Tier[],
  totalVolume: number,
): Tier {
  if (tiers.length === 0) {
    throw new Error("batch has no tiers");
  }
  const sorted = [...tiers].sort((a, b) => a.min_volume - b.min_volume);
  let chosen = sorted[0];
  for (const tier of sorted) {
    if (totalVolume < tier.min_volume) break;
    if (tier.max_volume === null || totalVolume <= tier.max_volume) {
      chosen = tier;
    }
  }
  return chosen;
}

/**
 * Payment Window Gatekeeper (pure time check) — the UI blocks the pay button
 * outside the [payment_opens_at, payment_closes_at) window. Unlike the
 * registration gate it does NOT depend on `batch.status` because a batch is
 * already transiting to `closed` when the payment window opens.
 */
export function evaluatePaymentWindow(
  timeline: BatchTimeline,
  nowIso: string,
): PaymentGateResult {
  const now = Date.parse(nowIso);
  const opens = Date.parse(timeline.payment_opens_at);
  const closes = Date.parse(timeline.payment_closes_at);

  if (now < opens) {
    return { allowed: false, reason: "not_open", state: "waiting" };
  }
  if (now >= closes) {
    return { allowed: false, reason: "expired", state: "expired" };
  }
  return { allowed: true, state: "open" };
}
