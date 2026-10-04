import type OpenAI from "openai";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Learner } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { OWNER_ID } from "@/lib/owner";
import { recordRating } from "@/lib/ratings";
import {
  EMPTY_RECAP,
  createSession,
  generateAndStoreRecap,
  getBrief,
  getSessionView,
  listRecentSessions,
  logSessionMistake,
  logSessionVocab,
  markEnded,
  markFailed,
  markStarted,
  runRecap,
} from "@/lib/sessions";
import type { RecapText, TranscriptEntry } from "@/lib/types";
import { nextUnitFor } from "@/lib/units";
import { cleanupTestRows, ensureOwner, describeDb, teardownOwner, TEST_PREFIX } from "@/test/db-fixture";

let nextId = 0;
vi.mock("node:crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:crypto")>()),
  randomUUID: () => `${TEST_PREFIX}${Date.now()}-${nextId++}`,
}));

const createSessionRoom = vi.fn(async (id: string) => ({
  roomName: `wafel-${id}`,
  token: "jwt",
  url: "wss://lk.test",
}));
vi.mock("@/lib/livekit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/livekit")>()),
  createSessionRoom: (id: string) => createSessionRoom(id),
}));

const transcript: TranscriptEntry[] = [
  { role: "tutor", text: "¡Hola! ¿Cómo estás?", t: 0 },
  { role: "learner", text: "Yo soy muy bien, gracias.", t: 3 },
  { role: "learner", text: "Me gusta la playa.", t: 8 },
];

const canned: RecapText = {
  summary: "Practicaste saludos.",
  levelNote: "Solid A1.",
  memory: "Likes the beach.",
  nextStep: "Keep drilling estar.",
};

const fakeOpenAI = (output_parsed: RecapText | null = canned) => {
  const parse = vi.fn(async () => ({ output_parsed }));
  return { client: { responses: { parse } } as unknown as OpenAI, parse };
};

const endedSession = async (unitId?: string) => {
  const { sessionId } = await createSession({ type: "LESSON", unitId });
  await markStarted(sessionId);
  await markEnded(sessionId, transcript, 90);
  return sessionId;
};

describeDb("sessions", () => {
  const testUnitId = `${TEST_PREFIX}sessions-unit`;
  const foreignDialectUnitId = `${TEST_PREFIX}sessions-unit-foreign`;
  const testWords = ["hola", "adiós", "gracias", "por favor", "¿mande?"];
  let learner: Learner;
  beforeAll(async () => {
    await ensureOwner();
    learner = await db.learner.findUniqueOrThrow({ where: { id: OWNER_ID } });
    const content = {
      language: learner.targetLanguage,
      level: learner.level,
      canDo: "I can test sessions.",
      pattern: { name: "ser", explanationEn: "x", examples: [] },
      targetWords: testWords.map((word) => ({ word, translation: word, example: word })),
      modelSentences: [],
    };
    const foreignDialect = learner.dialect === "ES" ? "MX" : "ES";
    await db.unit.createMany({
      data: [
        { id: testUnitId, dialect: learner.dialect, order: 9201, title: "Sessions test unit", ...content },
        { id: foreignDialectUnitId, dialect: foreignDialect, order: 9201, title: "Foreign dialect unit", ...content },
      ],
    });
  });
  afterEach(async () => {
    await db.unitProgress.deleteMany({ where: { unitId: testUnitId } });
    await cleanupTestRows();
    vi.clearAllMocks();
  });
  afterAll(async () => {
    await db.unit.deleteMany({ where: { id: { in: [testUnitId, foreignDialectUnitId] } } });
    await teardownOwner();
  });

  describe("createSession", () => {
    it("creates a CREATED LESSON with a brief snapshot, room and token", async () => {
      await db.vocabItem.create({
        data: { learnerId: OWNER_ID, word: `${TEST_PREFIX}hola`, translation: "hello", dueAt: new Date(0) },
      });
      const result = await createSession({ type: "LESSON" });

      expect(result.sessionId).toMatch(new RegExp(`^${TEST_PREFIX}`));
      expect(result).toMatchObject({ token: "jwt", url: "wss://lk.test" });
      expect(createSessionRoom).toHaveBeenCalledWith(result.sessionId);

      const row = await db.session.findUniqueOrThrow({ where: { id: result.sessionId } });
      expect(row.status).toBe("CREATED");
      expect(row.roomName).toBe(`wafel-${result.sessionId}`);
      const next = await nextUnitFor(learner);
      expect(next).not.toBeNull();
      expect(row.unitId).toBe(next?.id);
      expect(row.topic).toBe(next?.title);
      const brief = await getBrief(result.sessionId);
      expect(brief).toMatchObject({ sessionId: result.sessionId, type: "LESSON", topic: row.topic, dialect: learner.dialect });
      expect(brief.unit).toMatchObject({ id: next?.id, title: next?.title, wordScores: {} });
      expect(brief.dueVocab).toContainEqual({ word: `${TEST_PREFIX}hola`, translation: "hello" });
    });

    it("uses an explicit unit for LESSON, SHADOWING and MISTAKE_REVIEW, none for FREE_TALK", async () => {
      for (const type of ["LESSON", "SHADOWING"] as const) {
        const { sessionId } = await createSession({ type, unitId: testUnitId, topic: "ignored" });
        const row = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
        expect(row).toMatchObject({ unitId: testUnitId, topic: "Sessions test unit" });
        expect((await getBrief(sessionId)).unit?.id).toBe(testUnitId);
      }
      const review = await createSession({ type: "MISTAKE_REVIEW", unitId: testUnitId });
      const reviewRow = await db.session.findUniqueOrThrow({ where: { id: review.sessionId } });
      expect(reviewRow).toMatchObject({ unitId: testUnitId, topic: null });
      expect((await getBrief(review.sessionId)).unit?.id).toBe(testUnitId);
      const talk = await createSession({ type: "FREE_TALK", unitId: testUnitId });
      const talkRow = await db.session.findUniqueOrThrow({ where: { id: talk.sessionId } });
      expect(talkRow).toMatchObject({ unitId: null, topic: null });
      expect((await getBrief(talk.sessionId)).unit).toBeUndefined();
    });

    it("snapshots the learner's word scores for the unit into the brief", async () => {
      const first = await createSession({ type: "LESSON", unitId: testUnitId });
      await recordRating(first.sessionId, { target: "hola", kind: "WORD", score: 2 });
      const second = await createSession({ type: "LESSON", unitId: testUnitId });
      expect((await getBrief(second.sessionId)).unit?.wordScores).toEqual({ hola: { best: 2, sessions: [first.sessionId] } });
    });

    it("404s for unknown, foreign-language or foreign-dialect units", async () => {
      await expect(createSession({ type: "LESSON", unitId: "test-nope" })).rejects.toMatchObject({ status: 404 });
      await expect(createSession({ type: "LESSON", unitId: foreignDialectUnitId })).rejects.toMatchObject({ status: 404 });
    });


    it("requires a scenario for ROLEPLAY and snapshots it into the brief", async () => {
      await expect(createSession({ type: "ROLEPLAY" })).rejects.toMatchObject({ status: 400 });
      await expect(createSession({ type: "ROLEPLAY", scenarioId: "nope" })).rejects.toMatchObject({ status: 404 });
      const { sessionId } = await createSession({ type: "ROLEPLAY", scenarioId: "es-restaurant" });
      const brief = await getBrief(sessionId);
      expect(brief.scenario?.title).toBe("Ordering at a restaurant");
      expect((await getSessionView(sessionId)).scenarioTitle).toBe("Ordering at a restaurant");
    });

    it("marks the session FAILED when LiveKit setup throws", async () => {
      createSessionRoom.mockRejectedValueOnce(new Error("livekit down"));
      await expect(createSession({ type: "FREE_TALK" })).rejects.toThrow("livekit down");
      const [row] = await db.session.findMany({ where: { id: { startsWith: TEST_PREFIX } } });
      expect(row.status).toBe("FAILED");
    });
  });

  describe("lifecycle", () => {
    it("markStarted moves CREATED to ACTIVE once", async () => {
      const { sessionId } = await createSession({ type: "FREE_TALK" });
      expect(await markStarted(sessionId)).toEqual({ status: "ACTIVE", changed: true });
      expect(await markStarted(sessionId)).toEqual({ status: "ACTIVE", changed: false });
      const view = await getSessionView(sessionId);
      expect(view.status).toBe("ACTIVE");
      expect(view.startedAt).toBeInstanceOf(Date);
    });

    it("markEnded stores transcript, duration and cost", async () => {
      const id = await endedSession();
      const view = await getSessionView(id);
      expect(view).toMatchObject({ status: "ENDED", durationSec: 90, estimatedCostCents: 8, transcript });
      expect(view.endedAt).toBeInstanceOf(Date);
    });

    it("markEnded on a never-started session with zero duration fails it", async () => {
      const { sessionId } = await createSession({ type: "FREE_TALK" });
      expect(await markEnded(sessionId, [], 0)).toEqual({ status: "FAILED", changed: true });
      expect((await getSessionView(sessionId)).status).toBe("FAILED");
    });

    it("markEnded with zero duration on an ACTIVE session still ends it", async () => {
      const { sessionId } = await createSession({ type: "FREE_TALK" });
      await markStarted(sessionId);
      expect(await markEnded(sessionId, [], 0)).toEqual({ status: "RECAP_READY", changed: true });
    });

    it("markEnded without any learner lines stores a placeholder recap instead of scheduling one", async () => {
      const { sessionId } = await createSession({ type: "FREE_TALK" });
      await markStarted(sessionId);
      const tutorOnly = transcript.filter((entry) => entry.role === "tutor");
      expect(await markEnded(sessionId, tutorOnly, 45)).toEqual({ status: "RECAP_READY", changed: true });
      const view = await getSessionView(sessionId);
      expect(view).toMatchObject({ status: "RECAP_READY", durationSec: 45, transcript: tutorOnly, recap: EMPTY_RECAP });
      expect(await db.sessionMemory.findUnique({ where: { sessionId } })).toBeNull();
    });

    it("getSessionView exposes the cap from the brief snapshot", async () => {
      const { sessionId } = await createSession({ type: "FREE_TALK" });
      const learner = await db.learner.findUniqueOrThrow({ where: { id: OWNER_ID } });
      expect((await getSessionView(sessionId)).capMinutes).toBe(learner.sessionCapMinutes);
    });

    it("getSessionView exposes the unit's known lines for the phrase-card fallback", async () => {
      const { sessionId } = await createSession({ type: "LESSON", unitId: testUnitId });
      const { knownLines } = await getSessionView(sessionId);
      expect(knownLines).toEqual(testWords.map((word) => ({ spanish: word, english: `${word} — ${word}` })));
      expect((await getSessionView((await createSession({ type: "FREE_TALK" })).sessionId)).knownLines).toEqual([]);
    });

    it("concurrent markEnded calls transition exactly once", async () => {
      const { sessionId } = await createSession({ type: "FREE_TALK" });
      await markStarted(sessionId);
      const results = await Promise.all([
        markEnded(sessionId, transcript, 30),
        markEnded(sessionId, transcript, 40),
        markEnded(sessionId, transcript, 50),
      ]);
      expect(results.filter((r) => r.changed)).toHaveLength(1);
      expect(results.every((r) => r.status === "ENDED")).toBe(true);
      const { durationSec } = await getSessionView(sessionId);
      expect(results.find((r) => r.changed)).toBeDefined();
      expect([30, 40, 50]).toContain(durationSec);
    });

    it("markEnded after markFailed leaves the session FAILED", async () => {
      const { sessionId } = await createSession({ type: "FREE_TALK" });
      await markStarted(sessionId);
      expect(await markFailed(sessionId, "tutor gone")).toEqual({ status: "FAILED", changed: true });
      expect(await markEnded(sessionId, transcript, 30)).toEqual({ status: "FAILED", changed: false });
      const view = await getSessionView(sessionId);
      expect(view.status).toBe("FAILED");
      expect(view.transcript).toBeNull();
    });

    it("markEnded is a no-op for finished sessions", async () => {
      const id = await endedSession();
      expect(await markEnded(id, [], 5)).toEqual({ status: "ENDED", changed: false });
      expect((await getSessionView(id)).durationSec).toBe(90);
    });

    it("markFailed fails CREATED and ACTIVE sessions but not finished ones", async () => {
      const { sessionId } = await createSession({ type: "FREE_TALK" });
      await markFailed(sessionId, "tutor never arrived");
      expect((await getSessionView(sessionId)).status).toBe("FAILED");

      const ended = await endedSession();
      expect(await markFailed(ended, "late")).toEqual({ status: "ENDED", changed: false });
      expect((await getSessionView(ended)).status).toBe("ENDED");
    });

    it("throws 404 for unknown sessions", async () => {
      await expect(getSessionView("test-missing")).rejects.toMatchObject({ status: 404 });
      await expect(markStarted("test-missing")).rejects.toMatchObject({ status: 404 });
    });

    it("listRecentSessions returns newest first", async () => {
      const a = await createSession({ type: "FREE_TALK" });
      const b = await createSession({ type: "FREE_TALK" });
      const ids = (await listRecentSessions(2)).map((s) => s.id);
      expect(ids).toEqual([b.sessionId, a.sessionId]);
    });
  });

  describe("live logging", () => {
    it("logs vocab and mistakes against the session", async () => {
      const { sessionId } = await createSession({ type: "FREE_TALK" });
      await logSessionVocab(sessionId, { word: `${TEST_PREFIX}perro`, translation: "dog" });
      await logSessionMistake(sessionId, {
        original: "el problema es grave",
        corrected: "el problema es grave",
        explanation: "fine",
        category: "OTHER",
      });
      expect(await db.vocabItem.count({ where: { sourceSessionId: sessionId } })).toBe(1);
      expect(await db.mistake.count({ where: { sessionId } })).toBe(1);
      await expect(logSessionVocab("test-missing", { word: "x", translation: "y" })).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("generateAndStoreRecap", () => {
    it("builds mistakes and vocab from the live log, adds the unit snapshot, writes memory and marks RECAP_READY", async () => {
      const id = await endedSession(testUnitId);
      await logSessionVocab(id, { word: `${TEST_PREFIX}gracias`, translation: "thank you", example: "Gracias." });
      await logSessionMistake(id, { original: "yo soy muy bien", corrected: "estoy muy bien", explanation: "live", category: "CONJUGATION" });
      await recordRating(id, { target: "Hola", kind: "WORD", score: 1 });
      await recordRating(id, { target: "hola", kind: "WORD", score: 3 });
      await recordRating(id, { target: "¿Mande?", kind: "WORD", score: 2 });
      await recordRating(id, { target: "ser", kind: "PATTERN", score: 2 });
      const { client, parse } = fakeOpenAI();

      await generateAndStoreRecap(id, client);

      const view = await getSessionView(id);
      expect(view.status).toBe("RECAP_READY");
      const mistakes = [{ original: "yo soy muy bien", corrected: "estoy muy bien", explanation: "live", category: "CONJUGATION" }];
      const newVocab = [{ word: `${TEST_PREFIX}gracias`, translation: "thank you", example: "Gracias." }];
      expect(view.recap).toEqual({
        ...canned,
        mistakes,
        newVocab,
        unit: {
          id: testUnitId,
          title: "Sessions test unit",
          status: "IN_PROGRESS",
          wordsRated: [{ word: "hola", best: 3 }, { word: "¿mande?", best: 2 }],
          patternScore: 2,
          masteredWords: 0,
          totalWords: 5,
          nextStep: { unitId: expect.any(String), title: expect.any(String), raiseLevelSuggested: false },
        },
      });
      expect(await db.mistake.count({ where: { sessionId: id } })).toBe(1);
      expect(await db.vocabItem.count({ where: { word: { startsWith: TEST_PREFIX } } })).toBe(1);
      expect((await db.sessionMemory.findUnique({ where: { sessionId: id } }))?.summary).toBe("Likes the beach.");

      const [params] = parse.mock.calls[0] as unknown as [{ input: string }];
      expect(params.input).toContain('"corrected":"estoy muy bien"');
      expect(params.input).toContain(`"word":"${TEST_PREFIX}gracias"`);
    }, 20_000);

    it("omits the unit snapshot for sessions without a unit and never invents mistakes", async () => {
      const { sessionId } = await createSession({ type: "FREE_TALK" });
      await markStarted(sessionId);
      await markEnded(sessionId, transcript, 30);
      await generateAndStoreRecap(sessionId, fakeOpenAI().client);
      const view = await getSessionView(sessionId);
      expect(view.recap).toEqual({ ...canned, mistakes: [], newVocab: [] });
      expect(await db.mistake.count({ where: { sessionId } })).toBe(0);
    });

    it("refuses sessions that have not ended", async () => {
      const { sessionId } = await createSession({ type: "FREE_TALK" });
      await expect(generateAndStoreRecap(sessionId, fakeOpenAI().client)).rejects.toMatchObject({ status: 409 });
    });

    it("runRecap leaves the session ENDED and logs when the model fails", async () => {
      const id = await endedSession();
      const failing = { responses: { parse: vi.fn(async () => { throw new Error("model down"); }) } } as unknown as OpenAI;
      await runRecap(id, failing);
      expect((await getSessionView(id)).status).toBe("ENDED");
      expect(log.error).toHaveBeenCalledWith(expect.stringContaining(`recapError for session ${id}`), expect.any(Error));
    });

    it("caps newVocab at 8", async () => {
      const id = await endedSession();
      for (let i = 0; i < 10; i++) await logSessionVocab(id, { word: `${TEST_PREFIX}live${i}`, translation: "x" });
      await generateAndStoreRecap(id, fakeOpenAI().client);
      expect((await getSessionView(id)).recap?.newVocab).toHaveLength(8);
    }, 20_000);
  });
});
