import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, safeNextPath, verifySession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Wafel" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNextPath((await searchParams).next);
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  if (await verifySession(token, process.env.APP_SECRET ?? "")) redirect(next);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-[60%] rounded-full bg-honey/20 blur-3xl"
      />
      <div className="relative flex w-full max-w-xs flex-col items-center gap-10">
        <header className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-display text-7xl font-medium tracking-tight">
            Wafel<span className="text-honey">.</span>
          </h1>
          <p className="font-display text-lg text-muted-foreground italic">
            Un poco de español, cada día.
          </p>
        </header>
        <div className="w-full rounded-2xl border bg-card/80 p-4 shadow-[0_24px_48px_-24px_rgb(43_29_20/0.35)] backdrop-blur">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
