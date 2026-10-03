import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

let ip = 0;
const nextIp = () => `10.0.0.${++ip}`;

const login = (passphrase: unknown, from: string) =>
  POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": from },
      body: JSON.stringify({ passphrase }),
    }),
  );

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.stubEnv("APP_PASSPHRASE", "open sesame");
    vi.stubEnv("APP_SECRET", "test-secret-0123456789abcdef0123456789abcdef");
  });

  it("rejects a wrong passphrase with 401", async () => {
    const res = await login("wrong", nextIp());
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a malformed body with 400", async () => {
    const res = await login(42, nextIp());
    expect(res.status).toBe(400);
  });

  it("sets the session cookie and returns 204 on the right passphrase", async () => {
    const res = await login("open sesame", nextIp());
    expect(res.status).toBe(204);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("wafel_session=");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=7776000/);
  });

  it("rate limits the 6th attempt within a minute to 429", async () => {
    const from = nextIp();
    for (let i = 0; i < 5; i++) {
      expect((await login("wrong", from)).status).toBe(401);
    }
    expect((await login("open sesame", from)).status).toBe(429);
    expect((await login("open sesame", nextIp())).status).toBe(204);
  });
});
