import { describe, expect, it } from "vitest";
import type {
  Language,
  Learner,
  Mistake,
  Scenario,
  SessionMemory,
  Unit,
  UnitProgress,
  VocabItem,
} from "@/generated/prisma/client";
import type { Cefr, SessionType } from "@/generated/prisma/enums";
import { buildBrief, languagePolicyFor } from "@/lib/brief";

const day = (n: number) => new Date(Date.UTC(2026, 9, n));

const learner: Learner = {
  id: "owner",
  targetLanguage: "es",
  nativeLanguage: "en",
  level: "A2",
  dialect: "MX",
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

const unit: Unit = {
  id: "es-MX-A2-03",
  language: "es",
  dialect: "MX",
  level: "A2",
  order: 3,
  title: "Last weekend",
  canDo: "I can say what I did last weekend.",
  pattern: { name: "pretérito", explanationEn: "Past tense", examples: [{ es: "Fui", en: "I went" }] },
  targetWords: [
    { word: "fui", translation: "I went", example: "Fui al cine." },
    { word: "comí", translation: "I ate", example: "Comí tacos." },
  ],
  modelSentences: [{ es: "Fui al mercado.", en: "I went to the market." }],
  scenarioHint: "Tell a friend about your weekend.",
};

const progress: UnitProgress = {
  id: "p1",
  learnerId: "owner",
  unitId: unit.id,
  status: "IN_PROGRESS",
  wordScores: { fui: { best: 2, sessions: ["s0"] } },
  patternScore: 1,
  sessionsCount: 1,
  masteredAt: null,
  updatedAt: day(1),
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
  unitId: null,
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
      dialect: "MX",
      languagePolicy: "BILINGUAL",
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

  it("derives the language policy from the level", () => {
    const expected: Record<Cefr, string> = {
      A1: "BILINGUAL",
      A2: "BILINGUAL",
      B1: "MOSTLY_TARGET",
      B2: "TARGET_ONLY",
      C1: "TARGET_ONLY",
      C2: "TARGET_ONLY",
    };
    for (const [level, policy] of Object.entries(expected)) {
      expect(languagePolicyFor(level as Cefr)).toBe(policy);
      expect(build("FREE_TALK", { learner: { ...learner, level: level as Cefr } }).languagePolicy).toBe(policy);
    }
  });

  it("passes the learner dialect through", () => {
    expect(build("FREE_TALK", { learner: { ...learner, dialect: "ES" } }).dialect).toBe("ES");
  });

  it("includes the unit with learner word scores and sets topic to the unit title", () => {
    const brief = build("LESSON", { unit, progress });
    expect(brief.unit).toEqual({
      id: "es-MX-A2-03",
      title: "Last weekend",
      canDo: "I can say what I did last weekend.",
      pattern: unit.pattern,
      targetWords: unit.targetWords,
      modelSentences: unit.modelSentences,
      scenarioHint: "Tell a friend about your weekend.",
      wordScores: { fui: { best: 2, sessions: ["s0"] } },
    });
    expect(brief.topic).toBe("Last weekend");
  });

  it("gives an empty wordScores map and no scenarioHint when absent", () => {
    const brief = build("SHADOWING", { unit: { ...unit, scenarioHint: null }, progress: null });
    expect(brief.unit?.wordScores).toEqual({});
    expect(brief.unit).not.toHaveProperty("scenarioHint");
  });

  it("attaches the unit for LESSON, SHADOWING and MISTAKE_REVIEW only", () => {
    expect(build("LESSON", { unit }).unit).toBeDefined();
    expect(build("SHADOWING", { unit }).unit).toBeDefined();
    expect(build("MISTAKE_REVIEW", { unit }).unit).toBeDefined();
    expect(build("MISTAKE_REVIEW", { unit })).not.toHaveProperty("topic");
    expect(build("ROLEPLAY", { unit })).not.toHaveProperty("unit");
    expect(build("FREE_TALK", { unit })).not.toHaveProperty("unit");
    expect(build("LESSON")).not.toHaveProperty("unit");
  });
});
