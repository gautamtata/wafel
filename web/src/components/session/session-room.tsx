"use client";

import { LiveKitRoom } from "@livekit/components-react";
import { House, NotebookPen, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { SessionStatus, SessionType } from "@/generated/prisma/enums";
import { useHydrated } from "@/hooks/use-hydrated";
import { type PollStatus, useSessionStatus } from "@/hooks/use-session-status";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { clearCredentials, readCredentials, type SessionCredentials } from "@/lib/session-credentials";
import { LiveSession } from "./live-session";
import { PreStart } from "./pre-start";
import { StatusBanner } from "./status-banner";

type Phase =
  | { kind: "loading" }
  | { kind: "pre-start"; credentials: SessionCredentials }
  | { kind: "live"; credentials: SessionCredentials }
  | { kind: "wrapping" }
  | { kind: "tutor-missing" }
  | { kind: "stale" }
  | { kind: "error"; title: string; description: string; action: "home" | "recap" };

export type SessionRoomProps = {
  id: string;
  type: SessionType;
  status: SessionStatus;
  label: string;
  title: string;
  capMinutes: number;
};

const ERRORS = {
  failed: { title: "This session didn't connect", description: "Nothing was charged. Start a fresh one whenever you're ready.", action: "home" },
  recapFailed: { title: "We couldn't finish the recap", description: "Your session is saved. Check back from home in a minute.", action: "home" },
  slow: { title: "Still wrapping up", description: "The recap is taking longer than usual. Open it to retry.", action: "recap" },
  connect: { title: "Couldn't join the room", description: "Check your connection and try again from Practice.", action: "home" },
} satisfies Record<string, { title: string; description: string; action: "home" | "recap" }>;

const error = (key: keyof typeof ERRORS): Phase => ({ kind: "error", ...ERRORS[key] });

const markFailed = (id: string, reason: string) =>
  fetch(`/api/sessions/${id}/fail`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason }),
  }).catch(() => undefined);

function initialPhase(id: string, status: SessionStatus, hydrated: boolean): Phase {
  if (!hydrated) return { kind: "loading" };
  if (status === "FAILED") return error("failed");
  if (status === "ENDED" || status === "RECAP_READY") return { kind: "wrapping" };
  const credentials = readCredentials(id);
  if (credentials) return { kind: "pre-start", credentials };
  return status === "ACTIVE" ? { kind: "wrapping" } : { kind: "stale" };
}

const POLL_ERRORS: Partial<Record<PollStatus, Phase>> = {
  failed: error("recapFailed"),
  timeout: error("slow"),
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

const homeLink = (
  <Link href="/" className={buttonVariants({ variant: "outline" })}>
    <House data-icon="inline-start" />
    Back home
  </Link>
);

const recapLink = (id: string) => (
  <Link href={`/session/${id}/recap`} className={buttonVariants()}>
    <NotebookPen data-icon="inline-start" />
    Check recap
  </Link>
);

export function SessionRoom({ id, type, status, label, title, capMinutes }: SessionRoomProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const initial = useMemo(() => initialPhase(id, status, hydrated), [id, status, hydrated]);
  const [override, setPhase] = useState<Phase | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const current = override ?? initial;
  const poll = useSessionStatus(id, current.kind === "wrapping");
  const phase = POLL_ERRORS[poll] ?? current;

  useWakeLock(phase.kind === "live");
  useEffect(() => {
    if (poll === "ready") router.replace(`/session/${id}/recap`);
  }, [poll, id, router]);
  useEffect(() => {
    if (initial.kind !== "pre-start" && initial.kind !== "loading") clearCredentials(id);
  }, [id, initial.kind]);

  const onTutorMissing = useCallback(() => {
    setPhase({ kind: "tutor-missing" });
    clearCredentials(id);
    void markFailed(id, "tutor did not arrive");
  }, [id]);
  const onDisconnected = useCallback(() => {
    clearCredentials(id);
    setPhase((previous) => (previous?.kind === "live" ? { kind: "wrapping" } : previous));
  }, [id]);

  function retry() {
    setRetrying(true);
    router.push(`/practice?type=${type}`);
  }

  switch (phase.kind) {
    case "loading":
      return <div className="min-h-dvh" />;
    case "pre-start":
      return (
        <PreStart
          label={label}
          title={title}
          capMinutes={capMinutes}
          onStart={() => setPhase({ kind: "live", credentials: phase.credentials })}
        />
      );
    case "live":
      return (
        <LiveKitRoom
          serverUrl={phase.credentials.url}
          token={phase.credentials.token}
          connect
          audio
          video={false}
          onDisconnected={onDisconnected}
          onError={() => {
            clearCredentials(id);
            setPhase(error("connect"));
          }}
          onMediaDeviceFailure={() => setMicError("Allow microphone access in your browser settings, then start again.")}
          className="contents"
        >
          <LiveSession
            label={label}
            title={title}
            capMinutes={capMinutes}
            micError={micError}
            onTutorMissing={onTutorMissing}
          />
        </LiveKitRoom>
      );
    case "wrapping":
      return (
        <Centered>
          <StatusBanner icon="spinner" title="Wrapping up…" description="Your tutor is writing the recap." />
        </Centered>
      );
    case "tutor-missing":
      return (
        <Centered>
          <StatusBanner
            tone="warn"
            icon="alert"
            title="Your tutor didn't arrive"
            description="Something went wrong on our side. Nothing was charged; this session is closed."
            action={
              <Button type="button" onClick={retry} disabled={retrying}>
                <RotateCcw data-icon="inline-start" />
                Retry
              </Button>
            }
          />
        </Centered>
      );
    case "stale":
      return (
        <Centered>
          <StatusBanner
            title="This session can't be resumed"
            description="Start a new one from Practice."
            action={
              <Link href={`/practice?type=${type}`} className={buttonVariants()}>
                New session
              </Link>
            }
          />
        </Centered>
      );
    case "error":
      return (
        <Centered>
          <StatusBanner
            tone="warn"
            icon="alert"
            title={phase.title}
            description={phase.description}
            action={phase.action === "recap" ? recapLink(id) : homeLink}
          />
        </Centered>
      );
  }
}
