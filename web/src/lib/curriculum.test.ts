import { describe, expect, it } from "vitest";
import { Cefr } from "@/generated/prisma/enums";
import { CURRICULUM, nextTopic } from "@/lib/curriculum";

describe("CURRICULUM", () => {
  it("has at least 8 unique topics for every level", () => {
    for (const level of Object.values(Cefr)) {
      const topics = CURRICULUM[level];
      expect(topics.length).toBeGreaterThanOrEqual(8);
      expect(new Set(topics).size).toBe(topics.length);
    }
  });
});

describe("nextTopic", () => {
  it("returns the first topic when nothing is covered", () => {
    expect(nextTopic("A1", [])).toBe(CURRICULUM.A1[0]);
  });

  it("returns the first uncovered topic", () => {
    const [first, second, third] = CURRICULUM.A1;
    expect(nextTopic("A1", [first, third])).toBe(second);
  });

  it("ignores topics from other levels", () => {
    expect(nextTopic("B1", CURRICULUM.A1)).toBe(CURRICULUM.B1[0]);
  });

  it("wraps to the first topic when all are covered", () => {
    expect(nextTopic("C2", [...CURRICULUM.C2])).toBe(CURRICULUM.C2[0]);
  });
});
