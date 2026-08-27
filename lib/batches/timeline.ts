export const TIMELINE_FIELDS = [
  "registration_opens_at",
  "registration_closes_at",
  "payment_opens_at",
  "payment_closes_at",
  "estimated_ready_at",
] as const;

export type BatchTimelineField = (typeof TIMELINE_FIELDS)[number];

export type BatchTimeline = Record<BatchTimelineField, string>;

export type TimelineParseResult =
  | { data: BatchTimeline }
  | { error: string };

/**
 * PRD Time-Travel Validation (Modul Catalog): a batch timeline is only
 * accepted when all five parameters are absolute timestamps in strictly
 * linear order:
 *   Buka < Tutup < Mulai Payment < Batas Akhir Payment < Ready
 * Valid input is returned normalized to ISO 8601 UTC strings.
 */
export function parseBatchTimeline(input: unknown): TimelineParseResult {
  if (!input || typeof input !== "object") {
    return { error: "Timeline is required" };
  }
  const raw = input as Record<string, unknown>;

  const epochs: number[] = [];
  for (const field of TIMELINE_FIELDS) {
    const value = raw[field];
    // ponytail: ISO-shaped strings only — Date.parse alone accepts junk like 0 ("year 2000") or ["2036"]
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}(T[\s\S]*)?$/.test(value)
    ) {
      return { error: `Invalid or missing absolute timestamp: ${field}` };
    }
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) {
      return { error: `Invalid or missing absolute timestamp: ${field}` };
    }
    epochs.push(ms);
  }

  for (let i = 1; i < epochs.length; i++) {
    if (epochs[i] <= epochs[i - 1]) {
      return {
        error: `Timestamps must be strictly increasing: ${TIMELINE_FIELDS[i - 1]} < ${TIMELINE_FIELDS[i]}`,
      };
    }
  }

  const data = Object.fromEntries(
    TIMELINE_FIELDS.map((field, i) => [field, new Date(epochs[i]).toISOString()]),
  ) as BatchTimeline;
  return { data };
}
