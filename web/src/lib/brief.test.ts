import { describe, expect, it } from "vitest";
import type {
  Language,
  Learner,
  Mistake,
  Scenario,
  SessionMemory,
  VocabItem,
} from "@/generated/prisma/client";
import type { SessionType } from "@/generated/prisma/enums";
import { buildBrief } from "@/lib/brief";

const day = (n: number) => new Date(Date.UTC(2026, 9, n));

const learner: Learner = {
  id: "owner",
  targetLanguage: "es",
  nativeLanguage: "en",
  level: "A2",
  goals: "Travel to Mexico",
  correctionMode: "SUBTLE",
  pace: "SLOW",
  voice: "marin",
  sessionCapMinutes: 20,
  onboardedAt: day(1),
  createdAt: day(1),
  updatedAt: day(1),
};

const language: Language = { code: "es", name: "Spanish", nativeName: "Español", voice: "marin", enabled: true };

const scenario: Scenario = {
  id: "cafe",
  language: "es",
  title: "At the café",
  description: "Order breakfast",
  minLevel: "A1",
  setting: "A busy café in Madrid",
  tutorRole: "Waiter",
  learnerRole: "Customer",
  goals: ["Order a coffee", "Ask for the bill"],
};

const vocab = (i: number): VocabItem => ({
  id: `v${i}`,
  learnerId: "owner",
  word: `palabra${i}`,
  translation: `word${i}`,
  example: null,
  note: null,
  ease: 2.5,
  intervalDays: 0,
  reps: 0,
  dueAt: day(1),
  lastReviewedAt: null,
  sourceSessionId: null,
});

const mistake = (i: number): Mistake => ({
  id: `m${i}`,
  learnerId: "owner",
  sessionId: "s0",
  original: `original${i}`,
  corrected: `corrected${i}`,
  explanation: "",
  category: "GRAMMAR",
  timesPracticed: 0,
  resolved: false,
  createdAt: day(1),
});

const memory = (i: number): SessionMemory => ({
  id: `mem${i}`,
  sessionId: `s${i}`,
  summary: `memory${i}`,
  createdAt: day(i),
});

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const build = (type: SessionType, overrides: Partial<Parameters<typeof buildBrief>[0]> = {}) =>
  buildBrief({
    session: { id: "s1", type, topic: "Daily routine" },
    learner,
    language,
    scenario,
    dueVocab: [],
    mistakes: [],
    memories: [],
    ...overrides,
  });

describe("buildBrief", () => {
  it("maps learner and language settings", () => {
    expect(build("FREE_TALK")).toEqual({
      sessionId: "s1",
      type: "FREE_TALK",
      language: { code: "es", name: "Spanish", nativeName: "Español" },
      nativeLanguage: "en",
      level: "A2",
      correctionMode: "SUBTLE",
      pace: "SLOW",
      voice: "marin",
      capMinutes: 20,
      goals: "Travel to Mexico",
      dueVocab: [],
      recentMistakes: [],
      memories: [],
    });
  });

  it("omits goals when the learner has none", () => {
    expect(build("FREE_TALK", { learner: { ...learner, goals: null } })).not.toHaveProperty("goals");
  });

  it("caps due vocab at 8, mistakes at 6 and memories at 5", () => {
    const brief = build("FREE_TALK", {
      dueVocab: range(12).map(vocab),
      mistakes: range(10).map(mistake),
      memories: range(9).map(memory),
    });
    expect(brief.dueVocab).toHaveLength(8);
    expect(brief.dueVocab[0]).toEqual({ word: "palabra1", translation: "word1" });
    expect(brief.recentMistakes).toHaveLength(6);
    expect(brief.recentMistakes[0]).toEqual({ original: "original1", corrected: "corrected1", category: "GRAMMAR" });
    expect(brief.memories).toHaveLength(5);
  });

  it("skips resolved mistakes", () => {
    const brief = build("FREE_TALK", { mistakes: [{ ...mistake(1), resolved: true }, mistake(2)] });
    expect(brief.recentMistakes.map((m) => m.original)).toEqual(["original2"]);
  });

  it("orders memories newest first", () => {
    const brief = build("FREE_TALK", { memories: [memory(2), memory(7), memory(4)] });
    expect(brief.memories).toEqual(["memory7", "memory4", "memory2"]);
  });

  it("includes the scenario only for ROLEPLAY", () => {
    expect(build("ROLEPLAY").scenario).toEqual({
      title: "At the café",
      setting: "A busy café in Madrid",
      tutorRole: "Waiter",
      learnerRole: "Customer",
      goals: ["Order a coffee", "Ask for the bill"],
    });
    expect(build("LESSON")).not.toHaveProperty("scenario");
  });

  it("includes the topic only for LESSON and SHADOWING", () => {
    expect(build("LESSON").topic).toBe("Daily routine");
    expect(build("SHADOWING").topic).toBe("Daily routine");
    expect(build("ROLEPLAY")).not.toHaveProperty("topic");
    expect(build("FREE_TALK")).not.toHaveProperty("topic");
    expect(build("LESSON", { session: { id: "s1", type: "LESSON", topic: null } })).not.toHaveProperty("topic");
  });
});
