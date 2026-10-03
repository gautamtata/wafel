import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAgentRequest,
  requireOwner,
  SESSION_COOKIE,
  safeNextPath,
  signSession,
  verifySession,
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
    ["/", "/"],
    [undefined, "/"],
    [["/a", "/b"], "/"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["vocab", "/"],
  ])("maps %j to %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("requireOwner", () => {
  afterEach(() => {
    cookieJar.clear();
    vi.unstubAllEnvs();
  });

  it("resolves with a valid session cookie", async () => {
    vi.stubEnv("APP_SECRET", SECRET);
    cookieJar.set(SESSION_COOKIE, await signSession(SECRET));
    await expect(requireOwner()).resolves.toBeUndefined();
  });

  it("throws a 401 Response without a valid cookie", async () => {
    vi.stubEnv("APP_SECRET", SECRET);
    const thrown = await requireOwner().catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(401);
  });
});
