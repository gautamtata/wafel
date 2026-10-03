import { timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "wafel_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90;

const OWNER = "owner";
const ALG = "HS256";

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signSession(
  secret: string,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT()
    .setProtectedHeader({ alg: ALG })
    .setSubject(OWNER)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key(secret));
}

export async function verifySession(
  token: string,
  secret: string,
): Promise<boolean> {
  if (!token || !secret) return false;
  try {
    await jwtVerify(token, key(secret), { algorithms: [ALG], subject: OWNER });
    return true;
  } catch {
    return false;
  }
}

export async function hasValidSession(
  token: string | undefined,
): Promise<boolean> {
  return verifySession(token ?? "", process.env.APP_SECRET ?? "");
}

export async function requireOwner(): Promise<Response | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (await hasValidSession(token)) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function withOwner<T extends unknown[]>(
  handler: (req: Request, ...args: T) => Promise<Response>,
): (req: Request, ...args: T) => Promise<Response> {
  return async (req, ...args) => (await requireOwner()) ?? handler(req, ...args);
}

const NEXT_BASE = "http://wafel.invalid";

export function safeNextPath(next: string | string[] | undefined): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  try {
    const url = new URL(next, NEXT_BASE);
    const path = url.pathname + url.search + url.hash;
    const local = url.origin === NEXT_BASE && !/^\/[/\\]/.test(path);
    return local ? path : "/";
  } catch {
    return "/";
  }
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isAgentRequest(req: Request): boolean {
  const expected = process.env.AGENT_SHARED_SECRET;
  const provided = req.headers.get("x-agent-secret");
  if (!expected || provided === null) return false;
  return safeEqual(provided, expected);
}
