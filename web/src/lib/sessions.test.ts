import type OpenAI from "openai";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CURRICULUM } from "@/lib/curriculum";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { OWNER_ID } from "@/lib/owner";
import {
  coveredTopics,
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
import type { Recap, TranscriptEntry } from "@/lib/types";
import { cleanupTestRows, ensureOwner, teardownOwner, TEST_PREFIX } from "@/test/db-fixture";

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

const canned: Recap = {
  summary: "Practicaste saludos.",
  mistakes: [
    { original: "Yo soy muy bien", corrected: "Estoy muy bien", explanation: "estar", category: "GRAMMAR" },
    { original: "no en transcript", corrected: "x", explanation: "y", category: "OTHER" },
  ],
  newVocab: [
    { word: `${TEST_PREFIX}playa`, translation: "beach", example: "Me gusta la playa." },
    { word: `${TEST_PREFIX}Gracias`, translation: "thanks", example: "Gracias." },
  ],
  levelNote: "Solid A1.",
  memory: "Likes the beach.",
};

const fakeOpenAI = (output_parsed: Recap | null = canned) =>
  ({ responses: { parse: vi.fn(async () => ({ output_parsed })) } }) as unknown as OpenAI;

const endedSession = async () => {
  const { sessionId } = await createSession({ type: "LESSON" });
  await markStarted(sessionId);
  await markEnded(sessionId, transcript, 90);
  return sessionId;
};

let topics: readonly string[] = [];
beforeAll(async () => {
  await ensureOwner();
  const learner = await db.learner.findUniqueOrThrow({ where: { id: OWNER_ID } });
  topics = CURRICULUM[learner.level];
});
afterEach(async () => {
  await cleanupTestRows();
  vi.clearAllMocks();
});
afterAll(teardownOwner);

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
    expect(row.topic).toBe(topics[0]);
    const brief = await getBrief(result.sessionId);
    expect(brief).toMatchObject({ sessionId: result.sessionId, type: "LESSON", topic: row.topic });
    expect(brief.dueVocab).toContainEqual({ word: `${TEST_PREFIX}hola`, translation: "hello" });
  });

  it("picks the next topic not covered by a finished LESSON", async () => {
    const first = await createSession({ type: "LESSON" });
    const unfinished = await createSession({ type: "LESSON" });
    expect((await getSessionView(unfinished.sessionId)).topic).toBe(topics[0]);
    await markStarted(first.sessionId);
    await markEnded(first.sessionId, transcript, 60);
    const second = await createSession({ type: "LESSON" });
    const [a, b] = await Promise.all([getSessionView(first.sessionId), getSessionView(second.sessionId)]);
    expect(a.topic).toBe(topics[0]);
    expect(b.topic).toBe(topics[1]);
    const covered = await coveredTopics();
    expect(covered).toContain(a.topic);
    expect(covered).not.toContain(b.topic);
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
    expect(await markEnded(sessionId, [], 0)).toEqual({ status: "ENDED", changed: true });
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
  it("validates, merges live vocab/mistakes, writes memory and marks RECAP_READY", async () => {
    const id = await endedSession();
    await logSessionVocab(id, { word: `${TEST_PREFIX}gracias`, translation: "thank you" });
    await logSessionMistake(id, {
      original: "yo soy muy bien",
      corrected: "estoy muy bien",
      explanation: "live",
      category: "CONJUGATION",
    });

    await generateAndStoreRecap(id, fakeOpenAI());

    const view = await getSessionView(id);
    expect(view.status).toBe("RECAP_READY");
    expect(view.recap?.mistakes).toEqual([
      { original: "yo soy muy bien", corrected: "estoy muy bien", explanation: "live", category: "CONJUGATION" },
    ]);
    expect(view.recap?.newVocab.map((v) => v.word)).toEqual([`${TEST_PREFIX}playa`, `${TEST_PREFIX}Gracias`]);
    expect(await db.mistake.count({ where: { sessionId: id } })).toBe(1);

    const words = await db.vocabItem.findMany({ where: { word: { startsWith: TEST_PREFIX } }, select: { word: true, translation: true } });
    expect(words).toEqual(
      expect.arrayContaining([
        { word: `${TEST_PREFIX}gracias`, translation: "thanks" },
        { word: `${TEST_PREFIX}playa`, translation: "beach" },
      ]),
    );
    expect(words).toHaveLength(2);
    expect((await db.sessionMemory.findUnique({ where: { sessionId: id } }))?.summary).toBe("Likes the beach.");
  });

  it("refuses sessions that have not ended", async () => {
    const { sessionId } = await createSession({ type: "FREE_TALK" });
    await expect(generateAndStoreRecap(sessionId, fakeOpenAI())).rejects.toMatchObject({ status: 409 });
  });

  it("runRecap leaves the session ENDED and logs when the model fails", async () => {
    const id = await endedSession();
    const failing = { responses: { parse: vi.fn(async () => { throw new Error("model down"); }) } } as unknown as OpenAI;
    await runRecap(id, failing);
    expect((await getSessionView(id)).status).toBe("ENDED");
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining(`recapError for session ${id}`), expect.any(Error));
  });

  it("caps merged newVocab at 8", async () => {
    const id = await endedSession();
    const many = Array.from({ length: 6 }, (_, i) => ({ word: `${TEST_PREFIX}w${i}`, translation: `t${i}`, example: "" }));
    for (let i = 0; i < 4; i++) await logSessionVocab(id, { word: `${TEST_PREFIX}live${i}`, translation: "x" });
    await generateAndStoreRecap(id, fakeOpenAI({ ...canned, newVocab: many }));
    expect((await getSessionView(id)).recap?.newVocab).toHaveLength(8);
  });
});
