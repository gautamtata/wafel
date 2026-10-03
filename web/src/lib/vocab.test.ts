import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addVocab, countDueVocab, deleteVocab, listVocab, reviewVocab } from "@/lib/vocab";
import { cleanupTestRows, ensureOwner, describeDb, teardownOwner, TEST_PREFIX } from "@/test/db-fixture";

const word = `${TEST_PREFIX}casa`;

beforeAll(ensureOwner);
afterEach(cleanupTestRows);
afterAll(teardownOwner);

describeDb("addVocab", () => {
  it("creates a due-now item with initial SRS state", async () => {
    const before = Date.now();
    const item = await addVocab({ word, translation: "house", sourceSessionId: "test-s1" });
    expect(item).toMatchObject({ word, translation: "house", example: null, ease: 2.5, intervalDays: 0, reps: 0 });
    expect(item.dueAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("updates translation/example of an existing word but keeps its SRS state", async () => {
    const created = await addVocab({ word, translation: "house" });
    const reviewed = await reviewVocab(created.id, 2);
    expect(reviewed.reps).toBe(1);

    const again = await addVocab({ word: `${TEST_PREFIX}Casa!`, translation: "home", example: "Mi casa." });
    expect(again.id).toBe(created.id);
    expect(again).toMatchObject({
      word,
      translation: "home",
      example: "Mi casa.",
      ease: reviewed.ease,
      intervalDays: reviewed.intervalDays,
      reps: 1,
      dueAt: reviewed.dueAt,
    });
    expect(await db.vocabItem.count({ where: { word: { startsWith: TEST_PREFIX } } })).toBe(1);
  });

  it("keeps an existing example when none is given", async () => {
    await addVocab({ word, translation: "house", example: "Una casa." });
    const again = await addVocab({ word, translation: "house" });
    expect(again.example).toBe("Una casa.");
  });
});

describeDb("listVocab / reviewVocab / deleteVocab", () => {
  it("lists due items only when asked", async () => {
    const due = await addVocab({ word, translation: "house" });
    const later = await addVocab({ word: `${TEST_PREFIX}perro`, translation: "dog" });
    await reviewVocab(later.id, 3);

    const dueIds = (await listVocab({ dueOnly: true })).map((v) => v.id);
    expect(dueIds).toContain(due.id);
    expect(dueIds).not.toContain(later.id);
    expect((await listVocab()).map((v) => v.id)).toEqual(expect.arrayContaining([due.id, later.id]));
    expect(await countDueVocab()).toBeGreaterThanOrEqual(1);
  });

  it("applies a review grade and stamps lastReviewedAt", async () => {
    const item = await addVocab({ word, translation: "house" });
    const reviewed = await reviewVocab(item.id, 0);
    expect(reviewed.ease).toBe(2.3);
    expect(reviewed.lastReviewedAt).toBeInstanceOf(Date);
    await expect(reviewVocab("test-missing", 2)).rejects.toMatchObject({ status: 404 });
  });

  it("deletes an item and 404s on unknown ids", async () => {
    const item = await addVocab({ word, translation: "house" });
    await deleteVocab(item.id);
    expect(await db.vocabItem.findUnique({ where: { id: item.id } })).toBeNull();
    await expect(deleteVocab(item.id)).rejects.toMatchObject({ status: 404 });
  });
});
