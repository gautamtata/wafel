import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { db } from "@/lib/db";
import { countUnresolvedMistakes, listMistakes, logMistake, mistakesForSession, setMistakeResolved } from "@/lib/mistakes";
import { cleanupTestRows, ensureOwner, describeDb, teardownOwner, TEST_PREFIX } from "@/test/db-fixture";

const sessionId = `${TEST_PREFIX}m1`;
const input = {
  sessionId,
  original: "Yo soy bien",
  corrected: "Estoy bien",
  explanation: "estar for states",
  category: "GRAMMAR" as const,
};

beforeAll(async () => {
  await ensureOwner();
});
beforeAll(async () => {
  await db.session.create({
    data: { id: sessionId, type: "FREE_TALK", status: "ACTIVE", roomName: `wafel-${sessionId}`, brief: {} },
  });
});
afterEach(async () => {
  await db.mistake.deleteMany({ where: { sessionId } });
});
afterAll(async () => {
  await cleanupTestRows();
  await teardownOwner();
});

describeDb("mistakes", () => {
  it("logs a mistake once per normalized original within a session", async () => {
    const first = await logMistake(input);
    const dup = await logMistake({ ...input, original: "yo soy bien!" });
    expect(dup.id).toBe(first.id);
    expect(await mistakesForSession(sessionId)).toHaveLength(1);
  });

  it("lists, counts and resolves", async () => {
    const m = await logMistake(input);
    expect((await listMistakes()).map((x) => x.id)).toContain(m.id);
    const unresolvedBefore = await countUnresolvedMistakes();
    const resolved = await setMistakeResolved(m.id, true);
    expect(resolved.resolved).toBe(true);
    expect(await countUnresolvedMistakes()).toBe(unresolvedBefore - 1);
    await expect(setMistakeResolved("test-missing", true)).rejects.toMatchObject({ status: 404 });
  });
});
