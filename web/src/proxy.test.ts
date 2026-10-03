import { NextRequest } from "next/server";
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
import { config, proxy } from "./proxy";

const SECRET = "test-secret-0123456789abcdef0123456789abcdef";

describe("proxy matcher", () => {
  it.each(["/", "/vocab", "/session/abc/recap", "/api/sessions", "/loginx"])(
    "runs on %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );

  it.each([
    "/login",
    "/api/auth/login",
    "/api/agent/sessions/1/brief",
    "/_next/static/chunk.js",
    "/favicon.ico",
    "/icon.svg",
  ])("skips %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});

describe("proxy", () => {
  beforeEach(() => vi.stubEnv("APP_SECRET", SECRET));
  afterEach(() => vi.unstubAllEnvs());

  const request = (path: string, token?: string) => {
    const req = new NextRequest(`http://localhost${path}`);
    if (token) req.cookies.set(SESSION_COOKIE, token);
    return req;
  };

  it("redirects a page request without a session to /login with next", async () => {
    const res = await proxy(request("/vocab?tab=due"));
    expect(getRedirectUrl(res)).toBe(
      "http://localhost/login?next=%2Fvocab%3Ftab%3Ddue",
    );
  });

  it("omits next for the root path", async () => {
    const res = await proxy(request("/"));
    expect(getRedirectUrl(res)).toBe("http://localhost/login");
  });

  it("answers an API request without a session with 401", async () => {
    const res = await proxy(request("/api/sessions"));
    expect(res.status).toBe(401);
  });

  it("lets a valid session through", async () => {
    const res = await proxy(request("/vocab", await signSession(SECRET)));
    expect(getRedirectUrl(res)).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects an expired session", async () => {
    const res = await proxy(request("/", await signSession(SECRET, -1)));
    expect(getRedirectUrl(res)).toBe("http://localhost/login");
  });
});
