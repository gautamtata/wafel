import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { OWNER_ID } from "@/lib/owner";
import { getSessionView, markStarted } from "@/lib/sessions";
import type { Recap } from "@/lib/types";
import { cleanupTestRows, ensureOwner, teardownOwner, TEST_PREFIX } from "@/test/db-fixture";
import { ctx, loginAsOwner, logout, request, TEST_AGENT_SECRET, TEST_APP_SECRET } from "@/test/http";
import { POST as createSession } from "./route";
import { GET as getSession } from "./[id]/route";
import { POST as retryRecap } from "./[id]/recap/route";
import { POST as failSession } from "./[id]/fail/route";
import { GET as agentBrief } from "../agent/sessions/[id]/brief/route";
import { POST as agentStarted } from "../agent/sessions/[id]/started/route";
import { POST as agentVocab } from "../agent/sessions/[id]/vocab/route";
import { POST as agentMistakes } from "../agent/sessions/[id]/mistakes/route";
import { POST as agentEnded } from "../agent/sessions/[id]/ended/route";
import { POST as agentFailed } from "../agent/sessions/[id]/failed/route";

vi.mock("next/headers", () => import("@/test/next-headers-mock"));

const { after } = vi.hoisted(() => ({ after: vi.fn<(task: () => Promise<void>) => void>() }));
vi.mock("next/server", () => ({ after }));

const runScheduled = async () => {
  expect(after).toHaveBeenCalledTimes(1);
  await after.mock.calls[0][0]();
};

let nextId = 0;
vi.mock("node:crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:crypto")>()),
  randomUUID: () => `${TEST_PREFIX}${Date.now()}-${nextId++}`,
}));

vi.mock("@/lib/livekit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/livekit")>()),
  createSessionRoom: async (id: string) => ({ roomName: `wafel-${id}`, token: "jwt", url: "wss://lk.test" }),
}));

const canned: Recap = {
  summary: "Practicaste saludos.",
  mistakes: [{ original: "yo soy muy bien", corrected: "estoy muy bien", explanation: "estar", category: "GRAMMAR" }],
  newVocab: [{ word: `${TEST_PREFIX}playa`, translation: "beach", example: "Me gusta la playa." }],
  levelNote: "A1.",
  memory: "Likes the beach.",
};
const parse = vi.fn(async () => ({ output_parsed: canned }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));

const transcript = [
  { role: "tutor", text: "Hola", t: 0 },
  { role: "learner", text: "Yo soy muy bien, gracias.", t: 2 },
  { role: "learner", text: "Me gusta la playa.", t: 5 },
];

const agent = (secret = TEST_AGENT_SECRET) => ({ agentSecret: secret });

async function newSession(type = "FREE_TALK"): Promise<string> {
  const res = await createSession(request("/api/sessions", { method: "POST", body: { type } }));
  expect(res.status).toBe(200);
  return ((await res.json()) as { sessionId: string }).sessionId;
}

beforeAll(ensureOwner);
beforeEach(async () => {
  vi.stubEnv("APP_SECRET", TEST_APP_SECRET);
  vi.stubEnv("AGENT_SHARED_SECRET", TEST_AGENT_SECRET);
  await loginAsOwner();
});
afterEach(async () => {
  logout();
  vi.unstubAllEnvs();
  parse.mockClear();
  after.mockClear();
  await cleanupTestRows();
});
afterAll(teardownOwner);

describe("owner session routes", () => {
  it("401s without a session cookie", async () => {
    logout();
    expect((await createSession(request("/api/sessions", { method: "POST", body: { type: "LESSON" } }))).status).toBe(401);
    expect((await getSession(request("/api/sessions/x"), ctx("x"))).status).toBe(401);
    expect((await retryRecap(request("/api/sessions/x/recap", { method: "POST" }), ctx("x"))).status).toBe(401);
    expect((await failSession(request("/api/sessions/x/fail", { method: "POST", body: { reason: "r" } }), ctx("x"))).status).toBe(401);
  });

  it("POST /api/sessions creates a session and returns sessionId, token, url", async () => {
    const res = await createSession(request("/api/sessions", { method: "POST", body: { type: "LESSON" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ token: "jwt", url: "wss://lk.test" });
    expect(body.sessionId).toMatch(/^test-/);
  });

  it("POST /api/sessions rejects bad bodies and missing scenarios", async () => {
    expect((await createSession(request("/api/sessions", { method: "POST", body: { type: "NOPE" } }))).status).toBe(400);
    expect((await createSession(request("/api/sessions", { method: "POST" }))).status).toBe(400);
    expect((await createSession(request("/api/sessions", { method: "POST", body: { type: "ROLEPLAY" } }))).status).toBe(400);
    expect((await createSession(request("/api/sessions", { method: "POST", body: { type: "ROLEPLAY", scenarioId: "zzz" } }))).status).toBe(404);
  });

  it("GET /api/sessions/[id] returns the view or 404", async () => {
    const id = await newSession();
    const res = await getSession(request(`/api/sessions/${id}`), ctx(id));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id, type: "FREE_TALK", status: "CREATED", recap: null });
    expect((await getSession(request("/api/sessions/test-none"), ctx("test-none"))).status).toBe(404);
  });

  it("POST /api/sessions/[id]/fail marks the session FAILED", async () => {
    const id = await newSession();
    const res = await failSession(request(`/api/sessions/${id}/fail`, { method: "POST", body: { reason: "tutor did not arrive" } }), ctx(id));
    expect(res.status).toBe(204);
    expect((await getSessionView(id)).status).toBe("FAILED");
  });

  it("POST /api/sessions/[id]/recap reruns the recap for an ended session", async () => {
    const id = await newSession();
    await markStarted(id);
    parse.mockRejectedValueOnce(new Error("model down"));
    expect((await agentEnded(request("", { method: "POST", body: { transcript, durationSec: 60 }, ...agent() }), ctx(id))).status).toBe(204);
    await runScheduled();
    expect((await getSessionView(id)).status).toBe("ENDED");

    const res = await retryRecap(request(`/api/sessions/${id}/recap`, { method: "POST" }), ctx(id));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "RECAP_READY", recap: { summary: canned.summary } });
  });
});

describe("agent routes", () => {
  it("401s with a missing or wrong secret, even with an owner cookie", async () => {
    const id = await newSession();
    const bad = [undefined, "wrong"];
    for (const secret of bad) {
      const init = secret === undefined ? {} : agent(secret);
      expect((await agentBrief(request("", init), ctx(id))).status).toBe(401);
      expect((await agentStarted(request("", { method: "POST", body: {}, ...init }), ctx(id))).status).toBe(401);
      expect((await agentVocab(request("", { method: "POST", body: { word: "a", translation: "b" }, ...init }), ctx(id))).status).toBe(401);
      expect((await agentMistakes(request("", { method: "POST", body: {}, ...init }), ctx(id))).status).toBe(401);
      expect((await agentEnded(request("", { method: "POST", body: { transcript: [], durationSec: 0 }, ...init }), ctx(id))).status).toBe(401);
      expect((await agentFailed(request("", { method: "POST", body: { reason: "x" }, ...init }), ctx(id))).status).toBe(401);
    }
    expect((await getSessionView(id)).status).toBe("CREATED");
  });

  it("brief returns the snapshot and 404s for unknown sessions", async () => {
    const id = await newSession("LESSON");
    const res = await agentBrief(request("", agent()), ctx(id));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sessionId: id, type: "LESSON", language: { code: "es" }, topic: expect.any(String) });
    expect((await agentBrief(request("", agent()), ctx("test-none"))).status).toBe(404);
  });

  it("started → ACTIVE; vocab upsert keeps SRS state; mistakes logged", async () => {
    const id = await newSession();
    expect((await agentStarted(request("", { method: "POST", body: {}, ...agent() }), ctx(id))).status).toBe(204);
    expect((await getSessionView(id)).status).toBe("ACTIVE");

    const word = `${TEST_PREFIX}perro`;
    await db.vocabItem.create({
      data: { learnerId: OWNER_ID, word, translation: "dog", ease: 2.8, intervalDays: 6, reps: 2, dueAt: new Date("2030-01-01") },
    });
    const vocabRes = await agentVocab(request("", { method: "POST", body: { word: ` ${word} `, translation: "dog (m.)", example: "El perro ladra." }, ...agent() }), ctx(id));
    expect(vocabRes.status).toBe(200);
    expect(await vocabRes.json()).toEqual({ ok: true });
    const item = await db.vocabItem.findUniqueOrThrow({ where: { learnerId_word: { learnerId: OWNER_ID, word } } });
    expect(item).toMatchObject({ translation: "dog (m.)", example: "El perro ladra.", ease: 2.8, intervalDays: 6, reps: 2, dueAt: new Date("2030-01-01") });

    expect((await agentVocab(request("", { method: "POST", body: { word: "" }, ...agent() }), ctx(id))).status).toBe(400);

    const mistakeRes = await agentMistakes(request("", {
      method: "POST",
      body: { original: "yo soy bien", corrected: "estoy bien", explanation: "estar", category: "GRAMMAR" },
      ...agent(),
    }), ctx(id));
    expect(await mistakeRes.json()).toEqual({ ok: true });
    expect(await db.mistake.count({ where: { sessionId: id } })).toBe(1);
    expect((await agentMistakes(request("", { method: "POST", body: { original: "x", corrected: "y", explanation: "", category: "BOGUS" }, ...agent() }), ctx(id))).status).toBe(400);
  });

  it("ended returns 204 before the recap, which runs after the response", async () => {
    const id = await newSession();
    await markStarted(id);
    const res = await agentEnded(request("", { method: "POST", body: { transcript, durationSec: 125 }, ...agent() }), ctx(id));
    expect(res.status).toBe(204);
    expect(parse).not.toHaveBeenCalled();
    expect((await getSessionView(id)).status).toBe("ENDED");

    await runScheduled();
    const view = await getSessionView(id);
    expect(view).toMatchObject({ status: "RECAP_READY", durationSec: 125, estimatedCostCents: 11 });
    expect(view.recap?.mistakes).toEqual(canned.mistakes);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("ended on a never-started session with zero duration marks it FAILED without a recap", async () => {
    const id = await newSession();
    const res = await agentEnded(request("", { method: "POST", body: { transcript: [], durationSec: 0 }, ...agent() }), ctx(id));
    expect(res.status).toBe(204);
    expect((await getSessionView(id)).status).toBe("FAILED");
    expect(after).not.toHaveBeenCalled();
  });

  it("a second ended after the first does not schedule another recap", async () => {
    const id = await newSession();
    await markStarted(id);
    const body = { transcript, durationSec: 20 };
    expect((await agentEnded(request("", { method: "POST", body, ...agent() }), ctx(id))).status).toBe(204);
    expect((await agentEnded(request("", { method: "POST", body, ...agent() }), ctx(id))).status).toBe(204);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("ended after the owner failed the session keeps it FAILED and schedules nothing", async () => {
    const id = await newSession();
    await markStarted(id);
    expect((await failSession(request("", { method: "POST", body: { reason: "tutor did not arrive" } }), ctx(id))).status).toBe(204);
    expect((await agentEnded(request("", { method: "POST", body: { transcript, durationSec: 15 }, ...agent() }), ctx(id))).status).toBe(204);
    expect((await getSessionView(id)).status).toBe("FAILED");
    expect(after).not.toHaveBeenCalled();
  });

  it("failed marks the session FAILED and validates the body", async () => {
    const id = await newSession();
    expect((await agentFailed(request("", { method: "POST", body: {}, ...agent() }), ctx(id))).status).toBe(400);
    expect((await agentFailed(request("", { method: "POST", body: { reason: "brief fetch failed" }, ...agent() }), ctx(id))).status).toBe(204);
    expect((await getSessionView(id)).status).toBe("FAILED");
  });
});
