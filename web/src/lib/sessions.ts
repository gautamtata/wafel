import { randomUUID } from "node:crypto";
import type OpenAI from "openai";
import { z } from "zod";
import type { Learner, Prisma, Session } from "@/generated/prisma/client";
import { MistakeCategory, SessionStatus, SessionType } from "@/generated/prisma/enums";
import { ApiError, badRequest, notFound } from "@/lib/api";
import { buildBrief } from "@/lib/brief";
import { estimateCostCents } from "@/lib/cost";
import { nextTopic } from "@/lib/curriculum";
import { db } from "@/lib/db";
import { createSessionRoom, roomNameFor } from "@/lib/livekit";
import { logMistake, mistakesForSession } from "@/lib/mistakes";
import { generateRecap } from "@/lib/recap";
import { OWNER_ID } from "@/lib/owner";
import { normalize } from "@/lib/recap-validate";
import type { Brief, Recap, TranscriptEntry } from "@/lib/types";
import { addVocab } from "@/lib/vocab";

const sessionTypes = Object.values(SessionType) as [SessionType, ...SessionType[]];
const mistakeCategories = Object.values(MistakeCategory) as [MistakeCategory, ...MistakeCategory[]];

export const createSessionSchema = z.object({
  type: z.enum(sessionTypes),
  scenarioId: z.string().min(1).optional(),
});

export const transcriptSchema = z.array(
  z.object({ role: z.enum(["tutor", "learner"]), text: z.string(), t: z.number() }),
);

export const endedSchema = z.object({
  transcript: transcriptSchema,
  durationSec: z.number().int().min(0),
});

export const failedSchema = z.object({ reason: z.string() });

export const vocabLogSchema = z.object({
  word: z.string().min(1),
  translation: z.string().min(1),
  example: z.string().optional(),
});

export const mistakeLogSchema = z.object({
  original: z.string().min(1),
  corrected: z.string().min(1),
  explanation: z.string(),
  category: z.enum(mistakeCategories),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export type SessionView = {
  id: string;
  type: SessionType;
  status: SessionStatus;
  topic: string | null;
  scenarioTitle: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSec: number | null;
  estimatedCostCents: number | null;
  recap: Recap | null;
  transcript: TranscriptEntry[] | null;
};

const ENDED_BEFORE_START = "agent ended before start";

const viewSelect = {
  id: true,
  type: true,
  status: true,
  topic: true,
  startedAt: true,
  endedAt: true,
  durationSec: true,
  estimatedCostCents: true,
  recap: true,
  transcript: true,
  scenario: { select: { title: true } },
} satisfies Prisma.SessionSelect;

type SessionRow = Prisma.SessionGetPayload<{ select: typeof viewSelect }>;

const toView = (row: SessionRow): SessionView => ({
  id: row.id,
  type: row.type,
  status: row.status,
  topic: row.topic,
  scenarioTitle: row.scenario?.title ?? null,
  startedAt: row.startedAt,
  endedAt: row.endedAt,
  durationSec: row.durationSec,
  estimatedCostCents: row.estimatedCostCents,
  recap: (row.recap as Recap | null) ?? null,
  transcript: (row.transcript as TranscriptEntry[] | null) ?? null,
});

async function requireLearner(): Promise<Learner> {
  const learner = await db.learner.findUnique({ where: { id: OWNER_ID } });
  if (!learner) throw new ApiError("Learner has not completed onboarding", 409);
  return learner;
}

async function requireSession(id: string): Promise<Session> {
  const session = await db.session.findUnique({ where: { id } });
  if (!session) throw notFound("Session");
  return session;
}

export async function coveredTopics(): Promise<string[]> {
  const rows = await db.session.findMany({
    where: { type: SessionType.LESSON, topic: { not: null }, status: { not: SessionStatus.FAILED } },
    select: { topic: true },
    distinct: ["topic"],
  });
  return rows.flatMap((row) => (row.topic ? [row.topic] : []));
}

async function resolveScenario(input: CreateSessionInput, learner: Learner) {
  if (input.type !== SessionType.ROLEPLAY) return null;
  if (!input.scenarioId) throw badRequest("scenarioId is required for ROLEPLAY");
  const scenario = await db.scenario.findUnique({ where: { id: input.scenarioId } });
  if (!scenario || scenario.language !== learner.targetLanguage) throw notFound("Scenario");
  return scenario;
}

async function assembleBrief(
  session: { id: string; type: SessionType; topic: string | null },
  learner: Learner,
  scenario: Awaited<ReturnType<typeof resolveScenario>>,
): Promise<Brief> {
  const [language, dueVocab, mistakes, memories] = await Promise.all([
    db.language.findUnique({ where: { code: learner.targetLanguage } }),
    db.vocabItem.findMany({ where: { learnerId: learner.id, dueAt: { lte: new Date() } } }),
    db.mistake.findMany({ where: { learnerId: learner.id, resolved: false } }),
    db.sessionMemory.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  if (!language) throw new ApiError(`Language ${learner.targetLanguage} is not configured`, 500);
  return buildBrief({ session, learner, language, scenario, dueVocab, mistakes, memories });
}

export async function createSession(
  input: CreateSessionInput,
): Promise<{ sessionId: string; token: string; url: string }> {
  const learner = await requireLearner();
  const scenario = await resolveScenario(input, learner);
  const id = randomUUID();
  const topic =
    input.type === SessionType.LESSON ? nextTopic(learner.level, await coveredTopics()) : null;
  const brief = await assembleBrief({ id, type: input.type, topic }, learner, scenario);

  await db.session.create({
    data: {
      id,
      type: input.type,
      status: SessionStatus.CREATED,
      scenarioId: scenario?.id ?? null,
      topic,
      roomName: roomNameFor(id),
      brief,
    },
  });

  try {
    const room = await createSessionRoom(id);
    return { sessionId: id, token: room.token, url: room.url };
  } catch (error) {
    await markFailed(id, "could not create LiveKit room");
    throw error;
  }
}

export async function getSessionView(id: string): Promise<SessionView> {
  const row = await db.session.findUnique({ where: { id }, select: viewSelect });
  if (!row) throw notFound("Session");
  return toView(row);
}

export async function listRecentSessions(limit: number): Promise<SessionView[]> {
  const rows = await db.session.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: viewSelect,
  });
  return rows.map(toView);
}

export async function getBrief(id: string): Promise<Brief> {
  const session = await requireSession(id);
  return session.brief as Brief;
}

export async function markStarted(id: string): Promise<void> {
  await requireSession(id);
  await db.session.updateMany({
    where: { id, status: SessionStatus.CREATED },
    data: { status: SessionStatus.ACTIVE, startedAt: new Date() },
  });
}

export async function markFailed(id: string, reason: string): Promise<void> {
  await requireSession(id);
  console.warn(`session ${id} failed: ${reason}`);
  await db.session.updateMany({
    where: { id, status: { in: [SessionStatus.CREATED, SessionStatus.ACTIVE] } },
    data: { status: SessionStatus.FAILED, endedAt: new Date() },
  });
}

export async function markEnded(
  id: string,
  transcript: TranscriptEntry[],
  durationSec: number,
): Promise<SessionStatus> {
  const session = await requireSession(id);
  if (session.status === SessionStatus.CREATED && durationSec === 0) {
    await markFailed(id, ENDED_BEFORE_START);
    return SessionStatus.FAILED;
  }
  if (session.status !== SessionStatus.CREATED && session.status !== SessionStatus.ACTIVE) {
    return session.status;
  }
  await db.session.update({
    where: { id },
    data: {
      status: SessionStatus.ENDED,
      transcript,
      durationSec,
      endedAt: new Date(),
      estimatedCostCents: estimateCostCents(durationSec),
    },
  });
  return SessionStatus.ENDED;
}

export async function logSessionVocab(
  sessionId: string,
  input: z.infer<typeof vocabLogSchema>,
): Promise<void> {
  await requireSession(sessionId);
  await addVocab({ ...input, sourceSessionId: sessionId });
}

export async function logSessionMistake(
  sessionId: string,
  input: z.infer<typeof mistakeLogSchema>,
): Promise<void> {
  await requireSession(sessionId);
  await logMistake({ ...input, sessionId });
}

const dedupeBy = <T>(items: T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(key(item)) && seen.add(key(item)));
};

export async function generateAndStoreRecap(id: string, openai?: OpenAI): Promise<void> {
  const session = await requireSession(id);
  if (session.status !== SessionStatus.ENDED && session.status !== SessionStatus.RECAP_READY) {
    throw new ApiError(`Session is ${session.status}; recap needs an ended session`, 409);
  }
  const transcript = transcriptSchema.parse(session.transcript ?? []);
  const generated = await generateRecap(session.brief as Brief, transcript, openai);

  for (const mistake of generated.mistakes) await logMistake({ ...mistake, sessionId: id });
  for (const vocab of generated.newVocab) await addVocab({ ...vocab, sourceSessionId: id });

  const [mistakes, sessionVocab] = await Promise.all([
    mistakesForSession(id),
    db.vocabItem.findMany({ where: { learnerId: OWNER_ID, sourceSessionId: id } }),
  ]);
  const recap: Recap = {
    ...generated,
    mistakes: mistakes.map(({ original, corrected, explanation, category }) => ({
      original,
      corrected,
      explanation,
      category,
    })),
    newVocab: dedupeBy(
      [...generated.newVocab, ...sessionVocab.map(({ word, translation, example }) => ({ word, translation, example: example ?? "" }))],
      (v) => normalize(v.word),
    ),
  };

  await db.$transaction([
    db.sessionMemory.upsert({
      where: { sessionId: id },
      create: { sessionId: id, summary: recap.memory },
      update: { summary: recap.memory },
    }),
    db.session.update({ where: { id }, data: { recap, status: SessionStatus.RECAP_READY } }),
  ]);
}

export async function endSessionAndRecap(
  id: string,
  transcript: TranscriptEntry[],
  durationSec: number,
  openai?: OpenAI,
): Promise<void> {
  const status = await markEnded(id, transcript, durationSec);
  if (status !== SessionStatus.ENDED) return;
  try {
    await generateAndStoreRecap(id, openai);
  } catch (error) {
    console.error(`recapError for session ${id}`, error);
  }
}
