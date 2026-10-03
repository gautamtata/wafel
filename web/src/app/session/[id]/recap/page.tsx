import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/app-shell/empty-state";
import { RecapPending } from "@/components/recap/recap-pending";
import { RecapTopBar } from "@/components/recap/recap-top-bar";
import { RecapView } from "@/components/recap/recap-view";
import type { PickWord } from "@/components/recap/vocab-picks";
import { buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { normalize } from "@/lib/recap-validate";
import { getSessionView, type SessionView } from "@/lib/sessions";
import type { Recap } from "@/lib/types";
import { cn } from "@/lib/utils";
import { listVocab } from "@/lib/vocab";

export const metadata: Metadata = { title: "Recap · Wafel" };

async function loadSession(id: string): Promise<SessionView> {
  try {
    return await getSessionView(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

async function withDeckIds(words: Recap["newVocab"]): Promise<PickWord[]> {
  const deck = new Map((await listVocab()).map((item) => [normalize(item.word), item.id]));
  return words.map((word) => ({ ...word, id: deck.get(normalize(word.word)) ?? null }));
}

function RecapFailed() {
  return (
    <EmptyState
      icon={CloudOff}
      className="mt-6 py-16"
      title="This session didn't come through"
      actions={
        <>
          <Link href="/" className={cn(buttonVariants(), "h-11 rounded-xl px-5 text-base font-semibold")}>
            Back home
          </Link>
          <Link
            href="/practice"
            className={cn(buttonVariants({ variant: "ghost" }), "h-11 rounded-xl px-5 text-base")}
          >
            Try another session
          </Link>
        </>
      }
    >
      The connection dropped before there was anything to recap. Start again whenever you&apos;re
      ready.
    </EmptyState>
  );
}

async function RecapBody({ session }: { session: SessionView }) {
  if (session.status === "FAILED") return <RecapFailed />;
  if (session.status === "RECAP_READY" && session.recap) {
    const words = await withDeckIds(session.recap.newVocab);
    return <RecapView session={session} recap={session.recap} words={words} now={new Date()} />;
  }
  return <RecapPending sessionId={session.id} />;
}

export default async function RecapPage({ params }: PageProps<"/session/[id]/recap">) {
  const { id } = await params;
  const session = await loadSession(id);
  if (session.status === "CREATED" || session.status === "ACTIVE") redirect(`/session/${id}`);

  return (
    <>
      <RecapTopBar />
      <main className="mx-auto w-full max-w-[720px] px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+4rem)] sm:px-8 md:pt-12">
        <RecapBody session={session} />
      </main>
    </>
  );
}
