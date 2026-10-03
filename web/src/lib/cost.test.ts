import { describe, expect, it } from "vitest";
import { estimateCostCents } from "@/lib/cost";

describe("estimateCostCents", () => {
  it.each([
    [0, 0],
    [60, 5],
    [61, 6],
    [1200, 100],
  ])("%i seconds costs %i cents", (durationSec, cents) => {
    expect(estimateCostCents(durationSec)).toBe(cents);
  });
});
