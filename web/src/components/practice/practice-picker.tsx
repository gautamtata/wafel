"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SessionType } from "@/generated/prisma/enums";
import { type StartSessionBody, useStartSession } from "@/hooks/use-start-session";
import { availability, type PracticeContext } from "@/lib/practice";
import type { ScenarioOption } from "@/lib/scenarios";
import { ScenarioList } from "./scenario-list";
import { SessionTypeCard } from "./session-type-card";
import { type UnitOption, UnitPicker } from "./unit-picker";

const DESCRIPTIONS: Record<SessionType, string> = {
  SHADOWING: "Repeat after your tutor. Short phrases from your unit, rhythm and sounds. A gentle warm-up.",
  LESSON: "A guided ten minutes on one unit from your path: new words, one pattern, then you use them.",
  ROLEPLAY: "Act out a scene. Your tutor plays the waiter, the vendor, the doctor.",
  FREE_TALK: "Open conversation about whatever's on your mind.",
  MISTAKE_REVIEW: "Drill the corrections from your recent sessions until they stick.",
};

const TYPES = Object.values(SessionType);

const UNIT_TYPES: readonly SessionType[] = ["LESSON", "SHADOWING"];

const isSessionType = (value: string | null): value is SessionType =>
  TYPES.includes(value as SessionType);

export type PracticePickerProps = {
  context: PracticeContext;
  units: UnitOption[];
  currentUnitId: string | null;
  initialUnitId: string | null;
  scenarios: ScenarioOption[];
  initialType: string | null;
};

function bodyFor(type: SessionType, scenarioId: string | null, unitId: string | null): StartSessionBody {
  if (type === "ROLEPLAY" && scenarioId) return { type, scenarioId };
  if (UNIT_TYPES.includes(type) && unitId) return { type, unitId };
  return { type };
}

export function PracticePicker({
  context,
  units,
  currentUnitId,
  initialUnitId,
  scenarios,
  initialType,
}: PracticePickerProps) {
  const { start, pending } = useStartSession();
  const preselected = isSessionType(initialType) && !availability(initialType, context).disabled;
  const [type, setType] = useState<SessionType | null>(preselected ? initialType : null);
  const [scenarioId, setScenarioId] = useState<string | null>(scenarios[0]?.id ?? null);
  const [unitId, setUnitId] = useState(initialUnitId);

  const ready = type !== null && (type !== "ROLEPLAY" || scenarioId !== null);

  const onStart = () => {
    if (ready) void start(bodyFor(type, scenarioId, unitId));
  };

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
              {UNIT_TYPES.includes(candidate) && (
                <UnitPicker units={units} current={currentUnitId} value={unitId} onChange={setUnitId} />
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
          onClick={onStart}
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
