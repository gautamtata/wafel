import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { logMistake } from "@/lib/mistakes";
import { cleanupTestRows, ensureOwner, describeDb, teardownOwner, TEST_PREFIX } from "@/test/db-fixture";
import { ctx, loginAsOwner, logout, request, TEST_APP_SECRET } from "@/test/http";
import { GET as listMistakes } from "./route";
import { PATCH as patchMistake } from "./[id]/route";

vi.mock("next/headers", () => import("@/test/next-headers-mock"));

const sessionId = `${TEST_PREFIX}mr`;

beforeAll(async () => {
  await ensureOwner();
  await db.session.create({
    data: { id: sessionId, type: "FREE_TALK", status: "ENDED", roomName: `wafel-${sessionId}`, brief: {} },
  });
});
beforeEach(async () => {
  vi.stubEnv("APP_SECRET", TEST_APP_SECRET);
  await loginAsOwner();
});
afterEach(() => {
  logout();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await cleanupTestRows();
  await teardownOwner();
});

describeDb("mistake routes", () => {
  it("401s without a cookie", async () => {
    logout();
    expect((await listMistakes(request("/api/mistakes"))).status).toBe(401);
    expect((await patchMistake(request("", { method: "PATCH", body: { resolved: true } }), ctx("x"))).status).toBe(401);
  });

  it("lists and resolves mistakes", async () => {
    const m = await logMistake({ sessionId, original: "yo soy bien", corrected: "estoy bien", explanation: "", category: "GRAMMAR" });
    const list = (await (await listMistakes(request("/api/mistakes"))).json()) as { items: { id: string }[] };
    expect(list.items.map((i) => i.id)).toContain(m.id);

    const res = await patchMistake(request("", { method: "PATCH", body: { resolved: true } }), ctx(m.id));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: m.id, resolved: true });
    expect((await patchMistake(request("", { method: "PATCH", body: { resolved: "yes" } }), ctx(m.id))).status).toBe(400);
    expect((await patchMistake(request("", { method: "PATCH", body: { resolved: true } }), ctx("test-none"))).status).toBe(404);
  });
});
