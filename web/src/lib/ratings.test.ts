import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import type { Learner } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { normalizeWord, type WordScores } from "@/lib/mastery";
import { OWNER_ID } from "@/lib/owner";
import { ratingSchema, recordRating } from "@/lib/ratings";
import { getProgress } from "@/lib/units";
import { cleanupTestRows, ensureOwner, describeDb, teardownOwner, TEST_PREFIX } from "@/test/db-fixture";

const unitId = `${TEST_PREFIX}ratings-unit`;
const words = ["hola", "adiós", "¿mande?", "buenos días", "gracias"];
let learner: Learner;

const newSession = async (suffix: string, withUnit = true): Promise<string> => {
  const id = `${TEST_PREFIX}ratings-${suffix}-${Date.now()}`;
  await db.session.create({
    data: { id, type: "LESSON", status: "ACTIVE", roomName: `wafel-${id}`, brief: {}, unitId: withUnit ? unitId : null },
  });
  return id;
};

const rate = (sessionId: string, target: string, score: 0 | 1 | 2 | 3, kind: "WORD" | "PATTERN" = "WORD") =>
  recordRating(sessionId, { target, kind, score });

const progress = () => getProgress(OWNER_ID, unitId);

beforeAll(async () => {
  await ensureOwner();
  learner = await db.learner.findUniqueOrThrow({ where: { id: OWNER_ID } });
  await db.unit.create({
    data: {
      id: unitId,
      language: learner.targetLanguage,
      dialect: learner.dialect,
      level: learner.level,
      order: 9101,
      title: "Ratings test unit",
      canDo: "I can test ratings.",
      pattern: {},
      targetWords: words.map((word) => ({ word, translation: word, example: word })),
      modelSentences: [],
    },
  });
});
afterEach(async () => {
  await db.unitProgress.deleteMany({ where: { unitId } });
  await cleanupTestRows();
});
afterAll(async () => {
  await db.unit.deleteMany({ where: { id: unitId } });
  await teardownOwner();
});

it("ratingSchema accepts the agent body and rejects bad scores and kinds", () => {
  expect(ratingSchema.safeParse({ target: "hola", kind: "WORD", score: 2 }).success).toBe(true);
  expect(ratingSchema.safeParse({ target: "ser", kind: "PATTERN", score: 3, note: "good" }).success).toBe(true);
  expect(ratingSchema.safeParse({ target: "hola", kind: "WORD", score: 4 }).success).toBe(false);
  expect(ratingSchema.safeParse({ target: "hola", kind: "WORD", score: 1.5 }).success).toBe(false);
  expect(ratingSchema.safeParse({ target: "", kind: "WORD", score: 1 }).success).toBe(false);
  expect(ratingSchema.safeParse({ target: "hola", kind: "PHRASE", score: 1 }).success).toBe(false);
});

describeDb("recordRating", () => {
  it("404s for unknown sessions and 400s for sessions without a unit", async () => {
    await expect(rate("test-missing", "hola", 2)).rejects.toMatchObject({ status: 404 });
    const noUnit = await newSession("nounit", false);
    await expect(rate(noUnit, "hola", 2)).rejects.toMatchObject({ status: 400 });
    expect(await progress()).toBeNull();
  });

  it("creates IN_PROGRESS progress on the first WORD rating and keeps the best score", async () => {
    const session = await newSession("a");
    await rate(session, "Hola", 1);
    await rate(session, "hola", 3);
    await rate(session, "hola", 2);
    const row = await progress();
    expect(row).toMatchObject({ status: "IN_PROGRESS", patternScore: 0, sessionsCount: 1, masteredAt: null });
    expect(row?.wordScores).toEqual({ hola: { best: 3, sessions: [session] } });
  });

  it("records PATTERN ratings and marks the unit started even at score 0", async () => {
    const session = await newSession("p");
    await rate(session, "ser", 0, "PATTERN");
    expect(await progress()).toMatchObject({ status: "IN_PROGRESS", patternScore: 0, wordScores: {} });
    await rate(session, "ser", 2, "PATTERN");
    await rate(session, "ser", 1, "PATTERN");
    expect((await progress())?.patternScore).toBe(2);
  });

  it("counts each session once and reaches MASTERED after two sessions plus the pattern", async () => {
    const first = await newSession("s1");
    const second = await newSession("s2");
    for (const word of words.slice(0, 4)) await rate(first, word, 2);
    await rate(first, "ser", 3, "PATTERN");
    expect(await progress()).toMatchObject({ status: "IN_PROGRESS", sessionsCount: 1, masteredAt: null });

    for (const word of words.slice(0, 3)) await rate(second, word, 2);
    expect(await progress()).toMatchObject({ status: "IN_PROGRESS", sessionsCount: 2 });

    await rate(second, words[3], 3);
    const row = await progress();
    expect(row).toMatchObject({ status: "MASTERED", sessionsCount: 2, patternScore: 3 });
    expect(row?.masteredAt).toBeInstanceOf(Date);
    const masteredAt = row?.masteredAt;

    await rate(second, words[4], 1);
    expect(await progress()).toMatchObject({ status: "MASTERED", sessionsCount: 2, masteredAt });
  }, 20_000);

  it("does not lose concurrent ratings for the same unit", async () => {
    const session = await newSession("c");
    const results = await Promise.all([rate(session, words[0], 2), rate(session, words[1], 3), rate(session, words[2], 1)]);
    expect(results).toHaveLength(3);
    const row = await progress();
    const scores = row?.wordScores as WordScores;
    expect(Object.keys(scores).sort()).toEqual(words.slice(0, 3).map(normalizeWord).sort());
    expect(scores[words[1]]).toEqual({ best: 3, sessions: [session] });
    expect(row?.sessionsCount).toBe(1);
    expect(await db.unitProgress.count({ where: { unitId } })).toBe(1);
  });
});
