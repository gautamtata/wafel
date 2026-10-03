import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  safeEqual,
  signSession,
} from "@/lib/auth";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const allowAttempt = createRateLimiter(5, 60_000);

async function readPassphrase(req: Request): Promise<string | null> {
  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("passphrase" in body)) {
    return null;
  }
  return typeof body.passphrase === "string" ? body.passphrase : null;
}

export async function POST(req: Request) {
  if (!allowAttempt(clientIp(req))) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const { APP_PASSPHRASE, APP_SECRET } = process.env;
  if (!APP_PASSPHRASE || !APP_SECRET) {
    return NextResponse.json({ error: "Auth is not configured" }, { status: 500 });
  }

  const passphrase = await readPassphrase(req);
  if (passphrase === null) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!safeEqual(passphrase, APP_PASSPHRASE)) {
    return NextResponse.json({ error: "Wrong passphrase" }, { status: 401 });
  }

  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SESSION_COOKIE, await signSession(APP_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
