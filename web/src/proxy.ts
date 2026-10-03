import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (await verifySession(token, process.env.APP_SECRET ?? "")) {
    return NextResponse.next();
  }

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/((?!_next/|favicon\\.ico|api/auth/|api/agent/|login$|login/|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|txt|xml|webmanifest)$).*)",
  ],
};
