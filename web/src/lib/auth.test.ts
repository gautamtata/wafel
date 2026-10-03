import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasValidSession,
  isAgentRequest,
  requireOwner,
  SESSION_COOKIE,
  safeNextPath,
  signSession,
  verifySession,
  withOwner,
} from "@/lib/auth";

const SECRET = "test-secret-0123456789abcdef0123456789abcdef";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
  }),
}));

describe("session tokens", () => {
  it("verifies a freshly signed token", async () => {
    const token = await signSession(SECRET);
    expect(await verifySession(token, SECRET)).toBe(true);
  });

  it("rejects a tampered token", async () => {
    const token = await signSession(SECRET);
    const [header, payload, signature] = token.split(".");
    const flipped = signature[0] === "A" ? "B" : "A";
    const tampered = [header, payload, flipped + signature.slice(1)].join(".");
    expect(await verifySession(tampered, SECRET)).toBe(false);
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signSession("some-other-secret-value-0123456789");
    expect(await verifySession(token, SECRET)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const token = await signSession(SECRET, -1);
    expect(await verifySession(token, SECRET)).toBe(false);
  });

  it("rejects garbage and an empty secret", async () => {
    expect(await verifySession("not-a-jwt", SECRET)).toBe(false);
    expect(await verifySession(await signSession(SECRET), "")).toBe(false);
  });
});

describe("isAgentRequest", () => {
  const agentRequest = (secret?: string) =>
    new Request("http://localhost/api/agent/brief", {
      headers: secret === undefined ? {} : { "x-agent-secret": secret },
    });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the shared secret", () => {
    vi.stubEnv("AGENT_SHARED_SECRET", "agent-secret");
    expect(isAgentRequest(agentRequest("agent-secret"))).toBe(true);
  });

  it("rejects a wrong or missing header", () => {
    vi.stubEnv("AGENT_SHARED_SECRET", "agent-secret");
    expect(isAgentRequest(agentRequest("agent-secreT"))).toBe(false);
    expect(isAgentRequest(agentRequest("short"))).toBe(false);
    expect(isAgentRequest(agentRequest())).toBe(false);
  });

  it("rejects everything when the env secret is unset", () => {
    vi.stubEnv("AGENT_SHARED_SECRET", "");
    expect(isAgentRequest(agentRequest(""))).toBe(false);
    expect(isAgentRequest(agentRequest())).toBe(false);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/vocab?tab=due", "/vocab?tab=due"],
    ["/session/1/recap#mistakes", "/session/1/recap#mistakes"],
    ["/%09/evil.example", "/%09/evil.example"],
    ["/", "/"],
    [undefined, "/"],
    [["/a", "/b"], "/"],
    ["vocab", "/"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["/\t/evil.example", "/"],
    ["/\n/evil.example", "/"],
    ["/\r\n/evil.example", "/"],
    ["/.//evil.example", "/"],
    ["/\t\\evil.example", "/"],
  ])("maps %j to %j", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("owner guards", () => {
  type Ctx = { params: Promise<{ id: string }> };
  const ctx: Ctx = { params: Promise.resolve({ id: "s1" }) };
  const handler = withOwner(async (_req: Request, { params }: Ctx) =>
    Response.json({ id: (await params).id }),
  );
  const call = () => handler(new Request("http://localhost/api/sessions/s1"), ctx);

  beforeEach(() => vi.stubEnv("APP_SECRET", SECRET));
  afterEach(() => {
    cookieJar.clear();
    vi.unstubAllEnvs();
  });

  it("hasValidSession accepts only a valid token", async () => {
    expect(await hasValidSession(await signSession(SECRET))).toBe(true);
    expect(await hasValidSession(undefined)).toBe(false);
    expect(await hasValidSession(await signSession(SECRET, -1))).toBe(false);
  });

  it("requireOwner returns null with a valid session cookie", async () => {
    cookieJar.set(SESSION_COOKIE, await signSession(SECRET));
    expect(await requireOwner()).toBeNull();
  });

  it("requireOwner returns a JSON 401 without a valid cookie", async () => {
    cookieJar.set(SESSION_COOKIE, "garbage");
    const res = await requireOwner();
    expect(res?.status).toBe(401);
    expect(await res?.json()).toEqual({ error: "Unauthorized" });
  });

  it("withOwner answers 401 JSON without a cookie and skips the handler", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("withOwner runs the handler with its context for the owner", async () => {
    cookieJar.set(SESSION_COOKIE, await signSession(SECRET));
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "s1" });
  });
});
