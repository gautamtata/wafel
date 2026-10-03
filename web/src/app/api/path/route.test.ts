import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { Learner } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { OWNER_ID } from "@/lib/owner";
import { getProgress, nextUnitFor } from "@/lib/units";
import { cleanupTestRows, ensureOwner, describeDb, teardownOwner, TEST_PREFIX } from "@/test/db-fixture";
import { ctx, loginAsOwner, logout, request, TEST_AGENT_SECRET, TEST_APP_SECRET } from "@/test/http";
import { POST as rate } from "../agent/sessions/[id]/ratings/route";
import { GET as units } from "../units/route";
import { GET as path } from "./route";

vi.mock("next/headers", () => import("@/test/next-headers-mock"));

const unitId = `${TEST_PREFIX}path-unit`;
const sessionId = `${TEST_PREFIX}path-session`;
let learner: Learner;

const agent = (secret = TEST_AGENT_SECRET) => ({ agentSecret: secret });
const ratingRequest = (body: unknown, init: { agentSecret?: string } = agent()) => request("", { method: "POST", body, ...init });
type UnitRow = { id: string; status: string; masteredWords: number; totalWords: number; isCurrent: boolean };

beforeAll(async () => {
  await ensureOwner();
  learner = await db.learner.findUniqueOrThrow({ where: { id: OWNER_ID } });
  await db.unit.create({
    data: {
      id: unitId,
      language: learner.targetLanguage,
      dialect: learner.dialect,
      level: learner.level,
      order: 9401,
      title: "Path test unit",
      canDo: "I can test the path.",
      pattern: {},
      targetWords: [{ word: "uno", translation: "one", example: "uno" }, { word: "dos", translation: "two", example: "dos" }],
      modelSentences: [],
    },
  });
  await db.session.create({
    data: { id: sessionId, type: "LESSON", status: "ACTIVE", roomName: `wafel-${sessionId}`, brief: {}, unitId },
  });
});
beforeEach(async () => {
  vi.stubEnv("APP_SECRET", TEST_APP_SECRET);
  vi.stubEnv("AGENT_SHARED_SECRET", TEST_AGENT_SECRET);
  await loginAsOwner();
});
afterEach(async () => {
  logout();
  vi.unstubAllEnvs();
  await db.unitProgress.deleteMany({ where: { unitId } });
});
afterAll(async () => {
  await cleanupTestRows();
  await db.unit.deleteMany({ where: { id: unitId } });
  await teardownOwner();
});

describeDb("POST /api/agent/sessions/[id]/ratings", () => {
  it("401s without the agent secret, even with an owner cookie", async () => {
    expect((await rate(ratingRequest({ target: "uno", kind: "WORD", score: 2 }, {}), ctx(sessionId))).status).toBe(401);
    expect((await rate(ratingRequest({ target: "uno", kind: "WORD", score: 2 }, agent("wrong")), ctx(sessionId))).status).toBe(401);
    expect(await getProgress(OWNER_ID, unitId)).toBeNull();
  });

  it("validates the body and the session", async () => {
    expect((await rate(ratingRequest({ target: "uno", kind: "WORD", score: 5 }), ctx(sessionId))).status).toBe(400);
    expect((await rate(ratingRequest({}), ctx(sessionId))).status).toBe(400);
    expect((await rate(ratingRequest({ target: "uno", kind: "WORD", score: 2 }), ctx("test-none"))).status).toBe(404);
  });

  it("records WORD and PATTERN ratings into UnitProgress", async () => {
    const word = await rate(ratingRequest({ target: "Uno", kind: "WORD", score: 2, note: "clear" }), ctx(sessionId));
    expect(word.status).toBe(200);
    expect(await word.json()).toEqual({ ok: true });
    const pattern = await rate(ratingRequest({ target: "ser", kind: "PATTERN", score: 3 }), ctx(sessionId));
    expect(pattern.status).toBe(200);
    expect(await getProgress(OWNER_ID, unitId)).toMatchObject({
      status: "IN_PROGRESS",
      patternScore: 3,
      sessionsCount: 1,
      wordScores: { uno: { best: 2, sessions: [sessionId] } },
    });
  });
});

describeDb("GET /api/units and /api/path", () => {
  it("401 without a cookie", async () => {
    logout();
    expect((await units(request("/api/units"))).status).toBe(401);
    expect((await path(request("/api/path"))).status).toBe(401);
  });

  it("lists the level's units with progress and marks the current one", async () => {
    await rate(ratingRequest({ target: "uno", kind: "WORD", score: 2 }), ctx(sessionId));
    const res = await units(request(`/api/units?level=${learner.level}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { level: string; units: UnitRow[] };
    expect(body.level).toBe(learner.level);
    expect(body.units.every((u) => u.id.startsWith(TEST_PREFIX) || !u.id.startsWith("test-"))).toBe(true);
    expect(body.units.find((u) => u.id === unitId)).toEqual({
      id: unitId,
      level: learner.level,
      order: 9401,
      title: "Path test unit",
      canDo: "I can test the path.",
      status: "IN_PROGRESS",
      masteredWords: 0,
      totalWords: 2,
      isCurrent: false,
    });
    const current = await nextUnitFor(learner);
    expect(body.units.filter((u) => u.isCurrent).map((u) => u.id)).toEqual(current?.level === learner.level ? [current.id] : []);

    const defaulted = (await (await units(request("/api/units"))).json()) as { level: string };
    expect(defaulted.level).toBe(learner.level);
    expect((await units(request("/api/units?level=Z9"))).status).toBe(400);
  });

  it("returns the path over neighbouring levels with the current unit", async () => {
    const res = await path(request("/api/path"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { level: string; currentUnitId: string | null; levels: { level: string; units: UnitRow[] }[] };
    expect(body.level).toBe(learner.level);
    expect(body.levels.map((l) => l.level)).toContain(learner.level);
    expect(body.levels.length).toBeGreaterThanOrEqual(2);
    expect(body.levels.length).toBeLessThanOrEqual(3);
    const mine = body.levels.flatMap((l) => l.units).find((u) => u.id === unitId);
    expect(mine).toMatchObject({ status: "NOT_STARTED", masteredWords: 0, totalWords: 2, isCurrent: false });
    expect(body.currentUnitId).toBe((await nextUnitFor(learner))?.id ?? null);
    for (const level of body.levels) expect(level.units.every((u) => u.status && typeof u.isCurrent === "boolean")).toBe(true);
  });
});
