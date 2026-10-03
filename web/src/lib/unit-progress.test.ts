import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { OWNER_ID } from "@/lib/owner";
import { listUnitSummaries, neighbouringLevels, nextStepFor, pathFor } from "@/lib/unit-progress";
import { describeDb, ensureOwner, teardownOwner, TEST_PREFIX } from "@/test/db-fixture";

describe("neighbouringLevels", () => {
  it("returns the level and its neighbours, clamped at the ends", () => {
    expect(neighbouringLevels("A1")).toEqual(["A1", "A2"]);
    expect(neighbouringLevels("B1")).toEqual(["A2", "B1", "B2"]);
    expect(neighbouringLevels("C2")).toEqual(["C1", "C2"]);
  });
});

describeDb("unit progress views (db)", () => {
  const scope = { language: "es", dialect: "ES" } as const;
  const learner = { id: OWNER_ID, targetLanguage: "es", dialect: "ES", level: "A2" } as const;
  const ids = [`${TEST_PREFIX}up-A1-01`, `${TEST_PREFIX}up-A2-01`, `${TEST_PREFIX}up-A2-02`, `${TEST_PREFIX}up-B1-01`, `${TEST_PREFIX}up-B2-01`];
  const words = ["uno", "dos", "tres", "cuatro", "cinco"];
  const content = {
    canDo: "I can count.",
    pattern: {},
    targetWords: words.map((word) => ({ word, translation: word, example: word })),
    modelSentences: [],
  };
  const row = (id: string, level: "A1" | "A2" | "B1" | "B2", order: number) => ({ id, ...scope, level, order, title: id, ...content });

  beforeAll(async () => {
    await ensureOwner();
    await db.unit.createMany({
      data: [row(ids[0], "A1", 9301), row(ids[1], "A2", 9301), row(ids[2], "A2", 9302), row(ids[3], "B1", 9301), row(ids[4], "B2", 9301)],
    });
    const mastered = Object.fromEntries(words.slice(0, 4).map((w) => [w, { best: 3, sessions: ["s1", "s2"] }]));
    await db.unitProgress.createMany({
      data: [
        { learnerId: OWNER_ID, unitId: ids[1], status: "MASTERED", wordScores: mastered, patternScore: 2, masteredAt: new Date() },
        { learnerId: OWNER_ID, unitId: ids[2], status: "IN_PROGRESS", wordScores: { uno: { best: 2, sessions: ["s1"] } } },
      ],
    });
  });
  afterAll(async () => {
    await db.unitProgress.deleteMany({ where: { unitId: { startsWith: `${TEST_PREFIX}up-` } } });
    await db.unit.deleteMany({ where: { id: { startsWith: `${TEST_PREFIX}up-` } } });
    await teardownOwner();
  });

  it("summarises units with status, mastered counts and the current marker", async () => {
    const units = await listUnitSummaries(learner, ["A2"]);
    expect(units).toEqual([
      { id: ids[1], level: "A2", order: 9301, title: ids[1], canDo: "I can count.", status: "MASTERED", masteredWords: 4, totalWords: 5, isCurrent: false },
      { id: ids[2], level: "A2", order: 9302, title: ids[2], canDo: "I can count.", status: "IN_PROGRESS", masteredWords: 0, totalWords: 5, isCurrent: true },
    ]);
  });

  it("builds the path over the neighbouring levels only", async () => {
    const path = await pathFor(learner);
    expect(path.level).toBe("A2");
    expect(path.currentUnitId).toBe(ids[2]);
    expect(path.levels.map((l) => l.level)).toEqual(["A1", "A2", "B1"]);
    expect(path.levels.map((l) => l.units.map((u) => u.id))).toEqual([[ids[0]], [ids[1], ids[2]], [ids[3]]]);
    expect(path.levels[0].units[0]).toMatchObject({ status: "NOT_STARTED", masteredWords: 0, isCurrent: false });
  });

  it("suggests raising the level when the next unit is above the learner's level", async () => {
    expect(await nextStepFor(learner)).toEqual({ unitId: ids[2], title: ids[2], raiseLevelSuggested: false });
    expect(await nextStepFor({ ...learner, level: "B1" })).toEqual({ unitId: ids[3], title: ids[3], raiseLevelSuggested: false });
    await db.unitProgress.create({ data: { learnerId: OWNER_ID, unitId: ids[3], status: "MASTERED", wordScores: {} } });
    expect(await nextStepFor({ ...learner, level: "B1" })).toEqual({ unitId: ids[4], title: ids[4], raiseLevelSuggested: true });
    expect(await nextStepFor({ ...learner, level: "C2" })).toEqual({ unitId: null, title: null, raiseLevelSuggested: false });
  });
});
