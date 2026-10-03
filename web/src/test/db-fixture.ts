import { db } from "@/lib/db";
import { OWNER_ID } from "@/lib/owner";

export const TEST_PREFIX = "test-";

let createdLearner = false;

export async function ensureOwner(): Promise<void> {
  const existing = await db.learner.findUnique({ where: { id: OWNER_ID } });
  if (existing) return;
  createdLearner = true;
  await db.learner.create({
    data: { id: OWNER_ID, targetLanguage: "es", level: "A1", voice: "marin", onboardedAt: new Date() },
  });
}

export async function cleanupTestRows(): Promise<void> {
  await db.mistake.deleteMany({ where: { sessionId: { startsWith: TEST_PREFIX } } });
  await db.vocabItem.deleteMany({ where: { word: { startsWith: TEST_PREFIX } } });
  await db.vocabItem.deleteMany({ where: { sourceSessionId: { startsWith: TEST_PREFIX } } });
  await db.session.deleteMany({ where: { id: { startsWith: TEST_PREFIX } } });
}

export async function teardownOwner(): Promise<void> {
  if (createdLearner) await db.learner.delete({ where: { id: OWNER_ID } });
  createdLearner = false;
}
