import type OpenAI from "openai";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { OWNER_ID } from "@/lib/owner";
import {
  coveredTopics,
  createSession,
  endSessionAndRecap,
  generateAndStoreRecap,
  getBrief,
  getSessionView,
  listRecentSessions,
  logSessionMistake,
  logSessionVocab,
  markEnded,
  markFailed,
  markStarted,
} from "@/lib/sessions";
import type { Recap, TranscriptEntry } from "@/lib/types";
import { cleanupTestRows, ensureOwner, teardownOwner, TEST_PREFIX } from "@/test/db-fixture";

let nextId = 0;
vi.mock("node:crypto", () => ({ randomUUID: () => `${TEST_PREFIX}${Date.now()}-${nextId++}` }));

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

beforeAll(ensureOwner);
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
    expect(row.topic).toBe("Greetings and introductions");
    const brief = await getBrief(result.sessionId);
    expect(brief).toMatchObject({ sessionId: result.sessionId, type: "LESSON", topic: row.topic });
    expect(brief.dueVocab).toContainEqual({ word: `${TEST_PREFIX}hola`, translation: "hello" });
  });

  it("picks the next uncovered curriculum topic for a LESSON", async () => {
    const first = await createSession({ type: "LESSON" });
    const second = await createSession({ type: "LESSON" });
    const [a, b] = await Promise.all([getSessionView(first.sessionId), getSessionView(second.sessionId)]);
    expect(a.topic).toBe("Greetings and introductions");
    expect(b.topic).toBe("Numbers, prices and time");
    expect(await coveredTopics()).toEqual(expect.arrayContaining([a.topic, b.topic]));
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
    await markStarted(sessionId);
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
    expect(await markEnded(sessionId, [], 0)).toBe("FAILED");
    expect((await getSessionView(sessionId)).status).toBe("FAILED");
  });

  it("markEnded is a no-op for finished sessions", async () => {
    const id = await endedSession();
    expect(await markEnded(id, [], 5)).toBe("ENDED");
    expect((await getSessionView(id)).durationSec).toBe(90);
  });

  it("markFailed fails CREATED and ACTIVE sessions but not finished ones", async () => {
    const { sessionId } = await createSession({ type: "FREE_TALK" });
    await markFailed(sessionId, "tutor never arrived");
    expect((await getSessionView(sessionId)).status).toBe("FAILED");

    const ended = await endedSession();
    await markFailed(ended, "late");
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

  it("endSessionAndRecap leaves the session ENDED when the model fails", async () => {
    const { sessionId } = await createSession({ type: "FREE_TALK" });
    await markStarted(sessionId);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = { responses: { parse: vi.fn(async () => { throw new Error("model down"); }) } } as unknown as OpenAI;
    await endSessionAndRecap(sessionId, transcript, 30, failing);
    expect((await getSessionView(sessionId)).status).toBe("ENDED");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("recapError"), expect.anything());
    spy.mockRestore();
  });
});
