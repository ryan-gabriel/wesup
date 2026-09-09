export function isTierSchemeLocked(participantCount: number): boolean {
  return Number.isFinite(participantCount) && participantCount > 0;
}
