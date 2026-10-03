"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { SessionType } from "@/generated/prisma/enums";
import { storeCredentials } from "@/lib/session-credentials";

export type StartSessionBody = { type: SessionType; scenarioId?: string; unitId?: string };

type CreatedSession = { sessionId: string; token: string; url: string };

export function useStartSession(): { start: (body: StartSessionBody) => Promise<void>; pending: boolean } {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function start(body: StartSessionBody) {
    setPending(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { sessionId, token, url } = (await res.json()) as CreatedSession;
      storeCredentials(sessionId, { token, url });
      router.push(`/session/${sessionId}`);
    } catch {
      toast.error("Couldn't start a session. Try again in a moment.");
      setPending(false);
    }
  }

  return { start, pending };
}
