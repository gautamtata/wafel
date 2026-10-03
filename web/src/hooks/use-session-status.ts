import { useEffect, useState } from "react";
import type { SessionStatus } from "@/generated/prisma/enums";

export type PollStatus = "idle" | "polling" | "ready" | "failed" | "timeout";

export const POLL_INTERVAL_MS = 2_000;
export const POLL_TIMEOUT_MS = 60_000;

const TERMINAL: Partial<Record<SessionStatus, PollStatus>> = {
  RECAP_READY: "ready",
  FAILED: "failed",
};

async function fetchStatus(sessionId: string): Promise<SessionStatus | null> {
  try {
    const res = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { status?: SessionStatus };
    return body.status ?? null;
  } catch {
    return null;
  }
}

export function useSessionStatus(sessionId: string, enabled: boolean): PollStatus {
  const [result, setResult] = useState<PollStatus>("polling");

  useEffect(() => {
    if (!enabled) return;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const poll = async () => {
      const remote = await fetchStatus(sessionId);
      if (cancelled) return;
      const terminal = remote && TERMINAL[remote];
      if (terminal) return setResult(terminal);
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) return setResult("timeout");
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };
    timer = setTimeout(poll, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId, enabled]);

  return enabled ? result : "idle";
}
