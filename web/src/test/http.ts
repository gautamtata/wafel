import { SESSION_COOKIE, signSession } from "@/lib/auth";
import { cookieJar } from "@/test/next-headers-mock";

export const TEST_APP_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
export const TEST_AGENT_SECRET = "test-agent-secret";

export async function loginAsOwner(): Promise<void> {
  cookieJar.set(SESSION_COOKIE, await signSession(TEST_APP_SECRET));
}

export const logout = () => cookieJar.clear();

export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

type Init = { method?: string; body?: unknown; agentSecret?: string };

export function request(path: string, { method = "GET", body, agentSecret }: Init = {}): Request {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (agentSecret !== undefined) headers["x-agent-secret"] = agentSecret;
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
