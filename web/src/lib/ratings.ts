import { z } from "zod";
import type { Prisma, Unit, UnitProgress } from "@/generated/prisma/client";
import { TargetKind, UnitStatus } from "@/generated/prisma/enums";
import { badRequest, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { applyRating, computeUnitStatus, type Rating, type WordScores } from "@/lib/mastery";
import { OWNER_ID } from "@/lib/owner";
import { unitContent } from "@/lib/units";

const kinds = Object.values(TargetKind) as [TargetKind, ...TargetKind[]];

export const ratingSchema = z.object({
  target: z.string().trim().min(1),
  kind: z.enum(kinds),
  score: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  note: z.string().optional(),
}) satisfies z.ZodType<Rating>;

type Tx = Prisma.TransactionClient;

const wordScoresOf = (progress: UnitProgress | null): WordScores =>
  (progress?.wordScores as WordScores | null) ?? {};

const hasSession = (scores: WordScores, sessionId: string): boolean =>
  Object.values(scores).some((entry) => entry.sessions.includes(sessionId));

/** Serialises writers for one learner+unit so concurrent ratings never overwrite each other. */
async function lockProgress(tx: Tx, learnerId: string, unitId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${learnerId}:${unitId}`}))`;
}

function nextProgress(current: UnitProgress | null, unit: Unit, rating: Rating, sessionId: string) {
  const before = { wordScores: wordScoresOf(current), patternScore: current?.patternScore ?? 0 };
  const after = applyRating(before, rating, sessionId);
  const status = computeUnitStatus(after, unitContent(unit), true);
  const newSession = rating.kind === "WORD" && !hasSession(before.wordScores, sessionId);
  const mastered = status === UnitStatus.MASTERED && current?.status !== UnitStatus.MASTERED;
  return {
    wordScores: after.wordScores,
    patternScore: after.patternScore,
    status,
    sessionsCount: (current?.sessionsCount ?? 0) + (newSession ? 1 : 0),
    masteredAt: mastered ? new Date() : (current?.masteredAt ?? null),
  };
}

export async function recordRating(sessionId: string, rating: Rating): Promise<UnitProgress> {
  const session = await db.session.findUnique({ where: { id: sessionId }, select: { unitId: true } });
  if (!session) throw notFound("Session");
  if (!session.unitId) throw badRequest("Session has no unit to rate against");
  const unit = await db.unit.findUnique({ where: { id: session.unitId } });
  if (!unit) throw notFound("Unit");
  const learnerId = OWNER_ID;
  const key = { learnerId_unitId: { learnerId, unitId: unit.id } };

  return db.$transaction(async (tx) => {
    await lockProgress(tx, learnerId, unit.id);
    const current = await tx.unitProgress.findUnique({ where: key });
    const data = nextProgress(current, unit, rating, sessionId);
    return current
      ? tx.unitProgress.update({ where: key, data })
      : tx.unitProgress.create({ data: { learnerId, unitId: unit.id, ...data } });
  });
}
