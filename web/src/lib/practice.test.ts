import { describe, expect, it } from "vitest";
import { availability } from "./practice";

describe("availability", () => {
  it("locks free talk below B1", () => {
    expect(availability("FREE_TALK", { level: "A2", unresolvedMistakes: 0 }).disabled).toBe(true);
    expect(availability("FREE_TALK", { level: "B1", unresolvedMistakes: 0 }).disabled).toBe(false);
  });

  it("locks mistake review without open mistakes", () => {
    expect(availability("MISTAKE_REVIEW", { level: "C1", unresolvedMistakes: 0 }).disabled).toBe(true);
    expect(availability("MISTAKE_REVIEW", { level: "A1", unresolvedMistakes: 2 }).disabled).toBe(false);
  });

  it("leaves the rest open", () => {
    for (const type of ["SHADOWING", "LESSON", "ROLEPLAY"] as const) {
      expect(availability(type, { level: "A1", unresolvedMistakes: 0 }).disabled).toBe(false);
    }
  });
});
