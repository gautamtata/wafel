import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { addVocab, reviewVocab } from "@/lib/vocab";
import { cleanupTestRows, ensureOwner, teardownOwner, TEST_PREFIX } from "@/test/db-fixture";
import { ctx, loginAsOwner, logout, request, TEST_APP_SECRET } from "@/test/http";
import { GET as listVocab } from "./route";
import { DELETE as deleteVocab } from "./[id]/route";
import { POST as reviewRoute } from "./[id]/review/route";

vi.mock("next/headers", () => import("@/test/next-headers-mock"));

beforeAll(ensureOwner);
beforeEach(async () => {
  vi.stubEnv("APP_SECRET", TEST_APP_SECRET);
  await loginAsOwner();
});
afterEach(async () => {
  logout();
  vi.unstubAllEnvs();
  await cleanupTestRows();
});
afterAll(teardownOwner);

describe("vocab routes", () => {
  it("401s without a cookie", async () => {
    logout();
    expect((await listVocab(request("/api/vocab"))).status).toBe(401);
    expect((await deleteVocab(request("/api/vocab/x", { method: "DELETE" }), ctx("x"))).status).toBe(401);
    expect((await reviewRoute(request("/api/vocab/x/review", { method: "POST", body: { grade: 2 } }), ctx("x"))).status).toBe(401);
  });

  it("GET lists all or only due items", async () => {
    const due = await addVocab({ word: `${TEST_PREFIX}uno`, translation: "one" });
    const later = await reviewVocab((await addVocab({ word: `${TEST_PREFIX}dos`, translation: "two" })).id, 3);

    const all = (await (await listVocab(request("/api/vocab"))).json()) as { items: { id: string }[] };
    expect(all.items.map((i) => i.id)).toEqual(expect.arrayContaining([due.id, later.id]));

    const dueOnly = (await (await listVocab(request("/api/vocab?due=1"))).json()) as { items: { id: string }[] };
    expect(dueOnly.items.map((i) => i.id)).toContain(due.id);
    expect(dueOnly.items.map((i) => i.id)).not.toContain(later.id);
  });

  it("POST review applies the grade and validates it", async () => {
    const item = await addVocab({ word: `${TEST_PREFIX}tres`, translation: "three" });
    const res = await reviewRoute(request(`/api/vocab/${item.id}/review`, { method: "POST", body: { grade: 2 } }), ctx(item.id));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: item.id, reps: 1, intervalDays: 1 });
    expect((await reviewRoute(request("", { method: "POST", body: { grade: 7 } }), ctx(item.id))).status).toBe(400);
    expect((await reviewRoute(request("", { method: "POST", body: { grade: 1 } }), ctx("test-none"))).status).toBe(404);
  });

  it("DELETE removes the item", async () => {
    const item = await addVocab({ word: `${TEST_PREFIX}cuatro`, translation: "four" });
    expect((await deleteVocab(request("", { method: "DELETE" }), ctx(item.id))).status).toBe(204);
    expect(await db.vocabItem.findUnique({ where: { id: item.id } })).toBeNull();
    expect((await deleteVocab(request("", { method: "DELETE" }), ctx(item.id))).status).toBe(404);
  });
});
