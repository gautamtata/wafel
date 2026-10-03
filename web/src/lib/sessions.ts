import { randomUUID } from "node:crypto";
import { after } from "next/server";
import type OpenAI from "openai";
import { z } from "zod";
import type { Learner, Prisma, Session, Unit } from "@/generated/prisma/client";
import { MistakeCategory, SessionStatus, SessionType } from "@/generated/prisma/enums";
import { ApiError, badRequest, notFound } from "@/lib/api";
import { buildBrief } from "@/lib/brief";
import { estimateCostCents } from "@/lib/cost";
import { nextTopic } from "@/lib/curriculum";
import { db } from "@/lib/db";
import { requireLearner } from "@/lib/learner";
import { createSessionRoom, roomNameFor } from "@/lib/livekit";
import { logMistake, mistakesForSession } from "@/lib/mistakes";
import { log } from "@/lib/log";
import { OWNER_ID } from "@/lib/owner";
import { generateRecap } from "@/lib/recap";
import { MAX_NEW_VOCAB } from "@/lib/recap-validate";
import type { Brief, Recap, TranscriptEntry } from "@/lib/types";
import { recapUnitFor } from "@/lib/unit-progress";
import { getProgress, getUnit, nextUnitFor } from "@/lib/units";
import { addVocab, type vocabLogSchema } from "@/lib/vocab";

const sessionTypes = Object.values(SessionType) as [SessionType, ...SessionType[]];
const mistakeCategories = Object.values(MistakeCategory) as [MistakeCategory, ...MistakeCategory[]];

export const createSessionSchema = z.object({
  type: z.enum(sessionTypes),
  scenarioId: z.string().min(1).optional(),
  topic: z.string().min(1).max(120).optional(),
  unitId: z.string().min(1).optional(),
});

export const transcriptSchema = z.array(
  z.object({ role: z.enum(["tutor", "learner"]), text: z.string(), t: z.number() }),
);

export const endedSchema = z.object({
  transcript: transcriptSchema,
  durationSec: z.number().int().min(0),
});

export const failedSchema = z.object({ reason: z.string() });

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
  capMinutes: number;
  recap: Recap | null;
  transcript: TranscriptEntry[] | null;
};

const ENDED_BEFORE_START = "agent ended before start";
/** Stored directly when the learner never spoke; there is nothing for the recap model to work with. */
export const EMPTY_RECAP: Recap = {
  summary: "No conversation was recorded.",
  mistakes: [],
  newVocab: [],
  levelNote: "",
  memory: "",
  nextStep: "",
};
const OPEN: SessionStatus[] = [SessionStatus.CREATED, SessionStatus.ACTIVE];
const FINISHED: SessionStatus[] = [SessionStatus.ENDED, SessionStatus.RECAP_READY];

export type Transition = { status: SessionStatus; changed: boolean };

const viewSelect = {
  id: true,
  type: true,
  status: true,
  topic: true,
  startedAt: true,
  endedAt: true,
  durationSec: true,
  estimatedCostCents: true,
  brief: true,
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
  capMinutes: (row.brief as Brief).capMinutes,
  recap: (row.recap as Recap | null) ?? null,
  transcript: (row.transcript as TranscriptEntry[] | null) ?? null,
});

async function requireSession(id: string): Promise<Session> {
  const session = await db.session.findUnique({ where: { id } });
  if (!session) throw notFound("Session");
  return session;
}

export async function coveredTopics(): Promise<string[]> {
  const rows = await db.session.findMany({
    where: { type: SessionType.LESSON, topic: { not: null }, status: { in: FINISHED } },
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

const TOPIC_TYPES: SessionType[] = [SessionType.LESSON, SessionType.SHADOWING];
const UNIT_TYPES: SessionType[] = [...TOPIC_TYPES, SessionType.MISTAKE_REVIEW];

/** The unit a session works on: the explicit one, else the learner's next unit; the unit title doubles as the topic. */
async function resolveUnit(input: CreateSessionInput, learner: Learner): Promise<Unit | null> {
  if (!UNIT_TYPES.includes(input.type)) return null;
  if (!input.unitId) return nextUnitFor(learner);
  const unit = await getUnit(input.unitId);
  if (!unit || unit.language !== learner.targetLanguage) throw notFound("Unit");
  return unit;
}

async function resolveTopic(input: CreateSessionInput, learner: Learner, unit: Unit | null): Promise<string | null> {
  if (!TOPIC_TYPES.includes(input.type)) return null;
  return unit?.title ?? input.topic ?? nextTopic(learner.level, await coveredTopics());
}

async function assembleBrief(
  session: { id: string; type: SessionType; topic: string | null },
  learner: Learner,
  scenario: Awaited<ReturnType<typeof resolveScenario>>,
  unit: Unit | null,
): Promise<Brief> {
  const [language, dueVocab, mistakes, memories, progress] = await Promise.all([
    db.language.findUnique({ where: { code: learner.targetLanguage } }),
    db.vocabItem.findMany({ where: { learnerId: learner.id, dueAt: { lte: new Date() } } }),
    db.mistake.findMany({ where: { learnerId: learner.id, resolved: false } }),
    db.sessionMemory.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    unit ? getProgress(learner.id, unit.id) : null,
  ]);
  if (!language) throw new ApiError(`Language ${learner.targetLanguage} is not configured`, 500);
  return buildBrief({ session, learner, language, scenario, unit, progress, dueVocab, mistakes, memories });
}

export async function createSession(
  input: CreateSessionInput,
): Promise<{ sessionId: string; token: string; url: string }> {
  const learner = await requireLearner();
  const scenario = await resolveScenario(input, learner);
  const unit = await resolveUnit(input, learner);
  const id = randomUUID();
  const topic = await resolveTopic(input, learner, unit);
  const brief = await assembleBrief({ id, type: input.type, topic }, learner, scenario, unit);

  await db.session.create({
    data: {
      id,
      type: input.type,
      status: SessionStatus.CREATED,
      scenarioId: scenario?.id ?? null,
      unitId: unit?.id ?? null,
      topic,
      roomName: roomNameFor(id),
      brief,
    },
  });

  try {
    const room = await createSessionRoom(id);
    return { sessionId: id, token: room.token, url: room.url };
  } catch (error) {
    await markFailed(id, "could not create LiveKit room").catch((failError: unknown) => {
      log.error(`could not mark session ${id} failed`, failError);
    });
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

async function transition(
  id: string,
  from: SessionStatus[],
  data: Prisma.SessionUpdateManyMutationInput & { status: SessionStatus },
): Promise<Transition> {
  const { count } = await db.session.updateMany({ where: { id, status: { in: from } }, data });
  if (count > 0) return { status: data.status, changed: true };
  return { status: (await requireSession(id)).status, changed: false };
}

export async function markStarted(id: string): Promise<Transition> {
  return transition(id, [SessionStatus.CREATED], { status: SessionStatus.ACTIVE, startedAt: new Date() });
}

export async function markFailed(id: string, reason: string): Promise<Transition> {
  const result = await transition(id, OPEN, { status: SessionStatus.FAILED, endedAt: new Date() });
  if (result.changed) log.warn(`session ${id} failed: ${reason}`);
  return result;
}

export async function markEnded(
  id: string,
  transcript: TranscriptEntry[],
  durationSec: number,
): Promise<Transition> {
  if (durationSec === 0) {
    const failed = await transition(id, [SessionStatus.CREATED], {
      status: SessionStatus.FAILED,
      endedAt: new Date(),
    });
    if (failed.changed) {
      log.warn(`session ${id} failed: ${ENDED_BEFORE_START}`);
      return failed;
    }
  }
  const learnerSpoke = transcript.some((entry) => entry.role === "learner");
  return transition(id, OPEN, {
    status: learnerSpoke ? SessionStatus.ENDED : SessionStatus.RECAP_READY,
    recap: learnerSpoke ? undefined : EMPTY_RECAP,
    transcript,
    durationSec,
    endedAt: new Date(),
    estimatedCostCents: estimateCostCents(durationSec),
  });
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

async function recapUnit(session: Session): Promise<Recap["unit"]> {
  if (!session.unitId) return undefined;
  const [unit, learner] = await Promise.all([getUnit(session.unitId), requireLearner()]);
  return unit ? recapUnitFor(unit, session.id, learner) : undefined;
}

/** Builds the recap from the live log (Mistake and VocabItem rows), unit progress and the text model's summary. */
export async function generateAndStoreRecap(id: string, openai?: OpenAI): Promise<void> {
  const session = await requireSession(id);
  if (session.status !== SessionStatus.ENDED && session.status !== SessionStatus.RECAP_READY) {
    throw new ApiError(`Session is ${session.status}; recap needs an ended session`, 409);
  }
  const transcript = transcriptSchema.parse(session.transcript ?? []);
  const [rows, sessionVocab, unit] = await Promise.all([
    mistakesForSession(id),
    db.vocabItem.findMany({ where: { learnerId: OWNER_ID, sourceSessionId: id }, orderBy: { word: "asc" } }),
    recapUnit(session),
  ]);
  const mistakes = rows.map(({ original, corrected, explanation, category }) => ({ original, corrected, explanation, category }));
  const newVocab = sessionVocab
    .slice(0, MAX_NEW_VOCAB)
    .map(({ word, translation, example }) => ({ word, translation, example: example ?? "" }));
  const text = await generateRecap({ brief: session.brief as Brief, transcript, mistakes, newVocab }, openai);
  const recap: Recap = { ...text, mistakes, newVocab, ...(unit ? { unit } : {}) };

  await db.$transaction([
    db.sessionMemory.upsert({
      where: { sessionId: id },
      create: { sessionId: id, summary: recap.memory },
      update: { summary: recap.memory },
    }),
    db.session.update({ where: { id }, data: { recap, status: SessionStatus.RECAP_READY } }),
  ]);
}

export async function runRecap(id: string, openai?: OpenAI): Promise<void> {
  try {
    await generateAndStoreRecap(id, openai);
  } catch (error) {
    log.error(`recapError for session ${id}`, error);
  }
}

export function scheduleRecap(id: string): void {
  after(() => runRecap(id));
}
