import { describe, expect, it } from "vitest";
import { isTierSchemeLocked } from "@/lib/supplier-catalog/lock";

describe("isTierSchemeLocked (PRD 2.1.3 - lock tier)", () => {
  it("locks the tier scheme the moment the first participant joins", () => {
    expect(isTierSchemeLocked(1)).toBe(true);
  });

  it("locks the tier scheme once any participant has joined", () => {
    expect(isTierSchemeLocked(4)).toBe(true);
    expect(isTierSchemeLocked(100)).toBe(true);
  });

  it("keeps the tier scheme editable while there are no participants", () => {
    expect(isTierSchemeLocked(0)).toBe(false);
    expect(isTierSchemeLocked(-1)).toBe(false);
    expect(isTierSchemeLocked(Number.NaN)).toBe(false);
  });
});
