import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { OWNER_ID } from "@/lib/owner";
import { getProgress, getUnit, listUnits, nextUnitFor, selectNextUnit } from "@/lib/units";
import { describeDb, ensureOwner, teardownOwner, TEST_PREFIX } from "@/test/db-fixture";

const unit = (level: "A1" | "A2" | "B1", order: number) => ({ id: `${level}-${order}`, level, order } as const);
const units = [unit("A2", 2), unit("A1", 2), unit("A1", 1), unit("B1", 1), unit("A2", 1)];
const mastered = (...ids: string[]) => new Set(ids);

describe("selectNextUnit", () => {
  it("picks the first non-mastered unit at the learner level by order", () => {
    expect(selectNextUnit(units, mastered(), "A1")?.id).toBe("A1-1");
    expect(selectNextUnit(units, mastered("A1-1"), "A1")?.id).toBe("A1-2");
  });

  it("falls through to the first unit of the next level when all are mastered", () => {
    expect(selectNextUnit(units, mastered("A1-1", "A1-2"), "A1")?.id).toBe("A2-1");
    expect(selectNextUnit(units, mastered("A2-1", "A2-2"), "A2")?.id).toBe("B1-1");
  });

  it("offers the next level's first unit even when mastered (level should be raised)", () => {
    expect(selectNextUnit(units, mastered("A1-1", "A1-2", "A2-1", "A2-2"), "A1")?.id).toBe("A2-1");
  });

  it("skips levels without content and returns null at the end", () => {
    expect(selectNextUnit(units.filter((u) => u.level !== "A2"), mastered("A1-1", "A1-2"), "A1")?.id).toBe("B1-1");
    expect(selectNextUnit(units, mastered("B1-1"), "B1")).toBeNull();
    expect(selectNextUnit(units, mastered(), "C1")).toBeNull();
  });
});

describeDb("units (db)", () => {
  const scope = { language: "es", dialect: "ES" } as const;
  const ids = [`${TEST_PREFIX}A1-01`, `${TEST_PREFIX}A1-02`, `${TEST_PREFIX}A2-01`];
  const content = {
    canDo: "I can test.",
    pattern: {},
    targetWords: [{ word: `${TEST_PREFIX}palabra` }],
    modelSentences: [],
  };
  const learner = { id: OWNER_ID, targetLanguage: "es", dialect: "ES", level: "A1" } as const;

  beforeAll(async () => {
    await ensureOwner();
    await db.unit.createMany({
      data: [
        { id: ids[0], ...scope, level: "A1", order: 9001, title: "t1", ...content },
        { id: ids[1], ...scope, level: "A1", order: 9002, title: "t2", ...content },
        { id: ids[2], ...scope, level: "A2", order: 9001, title: "t3", ...content },
      ],
    });
  });
  afterAll(async () => {
    await db.unitProgress.deleteMany({ where: { unitId: { startsWith: TEST_PREFIX } } });
    await db.unit.deleteMany({ where: { id: { startsWith: TEST_PREFIX } } });
    await teardownOwner();
  });

  it("lists units by level in order and gets one by id", async () => {
    expect((await listUnits(scope, "A1")).map((u) => u.id)).toEqual([ids[0], ids[1]]);
    expect((await listUnits(scope)).map((u) => u.id)).toEqual(ids);
    expect((await getUnit(ids[2]))?.title).toBe("t3");
    expect(await getUnit("nope")).toBeNull();
  });

  it("advances past mastered units and into the next level", async () => {
    expect((await nextUnitFor(learner))?.id).toBe(ids[0]);
    await db.unitProgress.create({
      data: { learnerId: OWNER_ID, unitId: ids[0], status: "MASTERED", wordScores: {} },
    });
    expect((await nextUnitFor(learner))?.id).toBe(ids[1]);
    await db.unitProgress.create({
      data: { learnerId: OWNER_ID, unitId: ids[1], status: "IN_PROGRESS", wordScores: {} },
    });
    expect((await nextUnitFor(learner))?.id).toBe(ids[1]);
    await db.unitProgress.update({
      where: { learnerId_unitId: { learnerId: OWNER_ID, unitId: ids[1] } },
      data: { status: "MASTERED" },
    });
    expect((await nextUnitFor(learner))?.id).toBe(ids[2]);
    expect((await getProgress(OWNER_ID, ids[0]))?.status).toBe("MASTERED");
    expect(await getProgress(OWNER_ID, ids[2])).toBeNull();
  });
});
