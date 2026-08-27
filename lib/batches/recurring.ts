import { TIMELINE_FIELDS, type BatchTimeline } from "./timeline";

// ponytail: interval is fixed 24h days per PRD ("+7 hari"); calendar-aware
// shifting only if a real local-time requirement appears.
export function shiftBatchTimeline(
  timeline: BatchTimeline,
  intervalDays: number,
): BatchTimeline {
  if (!Number.isInteger(intervalDays) || intervalDays <= 0) {
    throw new Error("intervalDays must be a positive integer");
  }
  const deltaMs = intervalDays * 86_400_000;
  return Object.fromEntries(
    TIMELINE_FIELDS.map((field) => [
      field,
      new Date(Date.parse(timeline[field]) + deltaMs).toISOString(),
    ]),
  ) as BatchTimeline;
}
