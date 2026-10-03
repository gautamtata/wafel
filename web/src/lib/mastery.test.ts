import { describe, expect, it } from "vitest";
import {
  applyRating,
  computeUnitStatus,
  emptyProgress,
  isWordMastered,
  masteredWordCount,
  type MasteryProgress,
} from "@/lib/mastery";

const words = ["hola", "adiós", "gracias", "por favor", "sí"];
const unit = { targetWords: words.map((word) => ({ word })) };

const rate = (progress: MasteryProgress, target: string, score: 0 | 1 | 2 | 3, session: string) =>
  applyRating(progress, { target, kind: "WORD", score }, session);

describe("isWordMastered", () => {
  it("needs best >= 2 in at least two distinct sessions", () => {
    expect(isWordMastered({ best: 3, sessions: ["s1"] })).toBe(false);
    expect(isWordMastered({ best: 1, sessions: ["s1", "s2"] })).toBe(false);
    expect(isWordMastered({ best: 2, sessions: ["s1", "s2"] })).toBe(true);
    expect(isWordMastered(undefined)).toBe(false);
  });
});

describe("applyRating", () => {
  it("records best score and appends sessions uniquely", () => {
    let p = rate(emptyProgress(), "hola", 1, "s1");
    expect(p.wordScores.hola).toEqual({ best: 1, sessions: ["s1"] });
    p = rate(p, "hola", 3, "s1");
    expect(p.wordScores.hola).toEqual({ best: 3, sessions: ["s1"] });
    p = rate(p, "hola", 0, "s2");
    expect(p.wordScores.hola).toEqual({ best: 3, sessions: ["s1", "s2"] });
  });

  it("matches words case- and whitespace-insensitively without mutating input", () => {
    const start = emptyProgress();
    const p = rate(start, "  Hola ", 2, "s1");
    expect(p.wordScores.hola).toEqual({ best: 2, sessions: ["s1"] });
    expect(start.wordScores).toEqual({});
  });

  it("keeps the best pattern score", () => {
    let p = applyRating(emptyProgress(), { target: "ser", kind: "PATTERN", score: 2 }, "s1");
    p = applyRating(p, { target: "ser", kind: "PATTERN", score: 1 }, "s2");
    expect(p.patternScore).toBe(2);
    expect(p.wordScores).toEqual({});
  });
});

describe("computeUnitStatus", () => {
  it("is NOT_STARTED with no ratings and IN_PROGRESS after the first", () => {
    expect(computeUnitStatus(emptyProgress(), unit)).toBe("NOT_STARTED");
    expect(computeUnitStatus(rate(emptyProgress(), "hola", 0, "s1"), unit)).toBe("IN_PROGRESS");
    const patternOnly = applyRating(emptyProgress(), { target: "ser", kind: "PATTERN", score: 1 }, "s1");
    expect(computeUnitStatus(patternOnly, unit)).toBe("IN_PROGRESS");
  });

  it("is MASTERED at >= 80% words mastered and pattern >= 2", () => {
    let p = emptyProgress();
    for (const word of words.slice(0, 4)) {
      p = rate(p, word, 2, "s1");
      p = rate(p, word, 2, "s2");
    }
    expect(masteredWordCount(p, unit)).toBe(4);
    expect(computeUnitStatus(p, unit)).toBe("IN_PROGRESS");
    p = applyRating(p, { target: "ser", kind: "PATTERN", score: 2 }, "s2");
    expect(computeUnitStatus(p, unit)).toBe("MASTERED");
  });

  it("stays IN_PROGRESS below 80% words even with a strong pattern", () => {
    let p = applyRating(emptyProgress(), { target: "ser", kind: "PATTERN", score: 3 }, "s1");
    for (const word of words.slice(0, 3)) {
      p = rate(p, word, 3, "s1");
      p = rate(p, word, 3, "s2");
    }
    expect(computeUnitStatus(p, unit)).toBe("IN_PROGRESS");
  });

  it("ignores ratings for words outside the unit when counting mastery", () => {
    let p = emptyProgress();
    p = rate(p, "extra", 3, "s1");
    p = rate(p, "extra", 3, "s2");
    expect(masteredWordCount(p, unit)).toBe(0);
  });
});
