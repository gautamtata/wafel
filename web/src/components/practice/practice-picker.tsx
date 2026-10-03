"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SessionType } from "@/generated/prisma/enums";
import { availability, type PracticeContext } from "@/lib/practice";
import type { ScenarioOption } from "@/lib/scenarios";
import { storeCredentials } from "@/lib/session-credentials";
import { ScenarioList } from "./scenario-list";
import { SessionTypeCard } from "./session-type-card";

const DESCRIPTIONS: Record<SessionType, string> = {
  SHADOWING: "Repeat after your tutor. Short phrases, rhythm and sounds. A gentle warm-up.",
  LESSON: "A guided ten minutes on one topic from your path.",
  ROLEPLAY: "Act out a scene. Your tutor plays the waiter, the vendor, the doctor.",
  FREE_TALK: "Open conversation about whatever's on your mind.",
  MISTAKE_REVIEW: "Drill the corrections from your recent sessions until they stick.",
};

const TYPES = Object.values(SessionType);

const isSessionType = (value: string | null): value is SessionType =>
  TYPES.includes(value as SessionType);

export type PracticePickerProps = {
  context: PracticeContext;
  nextTopic: string;
  scenarios: ScenarioOption[];
  initialType: string | null;
};

type CreatedSession = { sessionId: string; token: string; url: string };

export function PracticePicker({ context, nextTopic, scenarios, initialType }: PracticePickerProps) {
  const router = useRouter();
  const preselected = isSessionType(initialType) && !availability(initialType, context).disabled;
  const [type, setType] = useState<SessionType | null>(preselected ? initialType : null);
  const [scenarioId, setScenarioId] = useState<string | null>(scenarios[0]?.id ?? null);
  const [pending, setPending] = useState(false);

  const ready = type !== null && (type !== "ROLEPLAY" || scenarioId !== null);

  async function start() {
    if (!ready) return;
    setPending(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(type === "ROLEPLAY" ? { type, scenarioId } : { type }),
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

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Session type" className="flex flex-col gap-2.5">
        {TYPES.map((candidate) => {
          const state = availability(candidate, context);
          return (
            <SessionTypeCard
              key={candidate}
              type={candidate}
              description={DESCRIPTIONS[candidate]}
              selected={candidate === type}
              disabledHint={state.disabled ? state.hint : undefined}
              onSelect={setType}
            >
              {candidate === "LESSON" && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Next topic · </span>
                  <span className="font-medium">{nextTopic}</span>
                </p>
              )}
              {candidate === "ROLEPLAY" && (
                <ScenarioList scenarios={scenarios} value={scenarioId} onChange={setScenarioId} />
              )}
            </SessionTypeCard>
          );
        })}
      </div>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-10 mt-4 md:bottom-6">
        <Button
          type="button"
          onClick={start}
          disabled={!ready || pending}
          className="h-14 w-full rounded-2xl text-base font-semibold shadow-[0_14px_36px_-14px_var(--honey)]"
        >
          {pending ? "Setting up…" : "Start lesson"}
          {!pending && <ArrowRight data-icon="inline-end" />}
        </Button>
      </div>
    </div>
  );
}
