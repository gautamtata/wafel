import { describe, expect, it } from "vitest";
import type { SessionStatus, SessionType } from "@/generated/prisma/enums";
import { CURRICULUM } from "@/lib/curriculum";
import {
  buildDashboard,
  computeStreak,
  pickSuggestion,
  type SessionSource,
  startOfMonth,
  startOfWeek,
} from "@/lib/dashboard";

const NOW = new Date(2026, 9, 3, 18, 30);
const daysAgo = (days: number, hour = 12) => new Date(2026, 9, 3 - days, hour);

let seq = 0;
function session(overrides: Partial<SessionSource> & { at: Date }): SessionSource {
  const { at, ...rest } = overrides;
  seq += 1;
  return {
    id: `s${seq}`,
    type: "LESSON" as SessionType,
    status: "RECAP_READY" as SessionStatus,
    topic: null,
    scenarioTitle: null,
    startedAt: at,
    endedAt: new Date(at.getTime() + 10 * 60_000),
    durationSec: 600,
    estimatedCostCents: 50,
    createdAt: at,
    ...rest,
  };
}

describe("computeStreak", () => {
  it("is zero with no sessions", () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it("counts today", () => {
    expect(computeStreak([daysAgo(0)], NOW)).toBe(1);
  });

  it("keeps a streak alive when the last session was yesterday", () => {
    expect(computeStreak([daysAgo(1), daysAgo(2)], NOW)).toBe(2);
  });

  it("breaks at the first missing day and counts each day once", () => {
    const dates = [daysAgo(0, 8), daysAgo(0, 20), daysAgo(1), daysAgo(3), daysAgo(4)];
    expect(computeStreak(dates, NOW)).toBe(2);
  });

  it("is zero when the last session was two days ago", () => {
    expect(computeStreak([daysAgo(2), daysAgo(3)], NOW)).toBe(0);
  });
});

describe("period starts", () => {
  it("starts the week on Monday at local midnight", () => {
    expect(startOfWeek(NOW)).toEqual(new Date(2026, 8, 28));
    expect(startOfWeek(new Date(2026, 8, 28, 0, 5))).toEqual(new Date(2026, 8, 28));
    expect(startOfWeek(new Date(2026, 9, 4, 23))).toEqual(new Date(2026, 8, 28));
  });

  it("starts the month on the first at local midnight", () => {
    expect(startOfMonth(NOW)).toEqual(new Date(2026, 9, 1));
  });
});

describe("pickSuggestion", () => {
  const base = { level: "A1" as const, coveredTopics: [], unresolvedMistakes: 0, wordsDue: 0 };

  it("suggests the next lesson topic by default", () => {
    const covered = [CURRICULUM.A1[0]];
    expect(pickSuggestion({ ...base, coveredTopics: covered })).toMatchObject({
      type: "LESSON",
      topic: CURRICULUM.A1[1],
    });
  });

  it("suggests a mistake review at three unresolved mistakes", () => {
    expect(pickSuggestion({ ...base, unresolvedMistakes: 2 }).type).toBe("LESSON");
    const suggestion = pickSuggestion({ ...base, unresolvedMistakes: 3 });
    expect(suggestion.type).toBe("MISTAKE_REVIEW");
    expect(suggestion.topic).toBeUndefined();
  });

  it("suggests vocab review at ten due words", () => {
    expect(pickSuggestion({ ...base, wordsDue: 9 }).type).toBe("LESSON");
    expect(pickSuggestion({ ...base, wordsDue: 10 }).type).toBe("VOCAB_REVIEW");
  });

  it("prefers mistakes over vocab", () => {
    expect(pickSuggestion({ ...base, unresolvedMistakes: 5, wordsDue: 30 }).type).toBe(
      "MISTAKE_REVIEW",
    );
  });

  it("always gives a reason", () => {
    for (const input of [base, { ...base, unresolvedMistakes: 4 }, { ...base, wordsDue: 12 }]) {
      expect(pickSuggestion(input).reason.length).toBeGreaterThan(0);
    }
  });
});

describe("buildDashboard", () => {
  const sessions: SessionSource[] = [
    session({ at: daysAgo(0), topic: CURRICULUM.A1[0], durationSec: 720, estimatedCostCents: 60 }),
    session({ at: daysAgo(0, 9), status: "CREATED", durationSec: null, estimatedCostCents: null }),
    session({ at: daysAgo(0, 8), status: "FAILED", durationSec: null, estimatedCostCents: null }),
    session({ at: daysAgo(1), type: "ROLEPLAY", status: "ENDED", scenarioTitle: "At the market" }),
    session({ at: daysAgo(6), durationSec: 300, estimatedCostCents: 25 }),
    session({ at: daysAgo(9), topic: CURRICULUM.A1[1], durationSec: 900, estimatedCostCents: 75 }),
  ];

  const view = buildDashboard(
    { level: "A1", sessions, wordsDue: 4, unresolvedMistakes: 1 },
    NOW,
  );

  it("computes the stats", () => {
    expect(view.streakDays).toBe(2);
    expect(view.minutesThisWeek).toBe(Math.round((720 + 600) / 60));
    expect(view.monthSpendCents).toBe(60 + 50);
    expect(view.wordsDue).toBe(4);
    expect(view.unresolvedMistakes).toBe(1);
    expect(view.level).toBe("A1");
  });

  it("suggests the first lesson topic not yet covered", () => {
    expect(view.nextSuggestion).toMatchObject({ type: "LESSON", topic: CURRICULUM.A1[2] });
  });

  it("lists recent sessions without never-started ones, newest first", () => {
    expect(view.recentSessions.map((s) => s.status)).not.toContain("CREATED");
    expect(view.recentSessions[0]).toEqual({
      id: sessions[0].id,
      type: "LESSON",
      status: "RECAP_READY",
      topic: CURRICULUM.A1[0],
      scenarioTitle: null,
      startedAt: sessions[0].startedAt,
      endedAt: sessions[0].endedAt,
      durationSec: 720,
      estimatedCostCents: 60,
    });
  });

  it("caps recent sessions at ten", () => {
    const many = Array.from({ length: 14 }, (_, i) => session({ at: daysAgo(i) }));
    const capped = buildDashboard(
      { level: "B1", sessions: many, wordsDue: 0, unresolvedMistakes: 0 },
      NOW,
    );
    expect(capped.recentSessions).toHaveLength(10);
    expect(capped.streakDays).toBe(14);
  });
});
