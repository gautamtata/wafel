import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SessionRoom } from "@/components/session/session-room";
import { ApiError } from "@/lib/api";
import { getLearner } from "@/lib/learner";
import { hasRecapPage } from "@/lib/links";
import { SESSION_TYPE_LABELS, sessionTitle } from "@/lib/session-labels";
import { getSessionView, type SessionView } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Session · Wafel" };

async function loadSession(id: string): Promise<SessionView> {
  try {
    return await getSessionView(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function SessionPage({ params }: PageProps<"/session/[id]">) {
  const { id } = await params;
  const [learner, session] = await Promise.all([getLearner(), loadSession(id)]);
  if (!learner?.onboardedAt) redirect("/onboarding");
  if (hasRecapPage(session.status)) redirect(`/session/${id}/recap`);

  return (
    <SessionRoom
      id={id}
      type={session.type}
      status={session.status}
      label={SESSION_TYPE_LABELS[session.type]}
      title={sessionTitle(session)}
      capMinutes={session.capMinutes}
      knownLines={session.knownLines}
    />
  );
}
