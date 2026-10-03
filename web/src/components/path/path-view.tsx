"use client";

import { useState } from "react";
import type { Cefr } from "@/generated/prisma/enums";
import { useStartSession } from "@/hooks/use-start-session";
import { levelIndex } from "@/lib/levels";
import type { UnitPattern } from "@/lib/unit-schema";
import type { UnitSummary } from "@/lib/unit-progress";
import { LevelSection } from "./level-section";
import { UnitCard } from "./unit-card";

export type PathUnit = UnitSummary & { pattern: UnitPattern };
export type PathLevel = { level: Cefr; units: PathUnit[] };

type PathViewProps = { learnerLevel: Cefr; levels: PathLevel[] };

const currentOf = (levels: PathLevel[]) => levels.flatMap((l) => l.units).find((u) => u.isCurrent)?.id ?? null;

export function PathView({ learnerLevel, levels }: PathViewProps) {
  const { start, pending } = useStartSession();
  const [openId, setOpenId] = useState<string | null>(() => currentOf(levels));
  const [startingId, setStartingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<Cefr>>(
    () =>
      new Set(
        levels
          .filter(({ level, units }) => levelIndex(level) <= levelIndex(learnerLevel) || units.some((u) => u.isCurrent))
          .map(({ level }) => level),
      ),
  );

  const toggleLevel = (level: Cefr) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(level)) next.add(level);
      return next;
    });

  const startUnit = (unitId: string) => {
    setStartingId(unitId);
    void start({ type: "LESSON", unitId });
  };

  return (
    <div className="flex flex-col gap-10">
      {levels.map(({ level, units }) => (
        <LevelSection
          key={level}
          level={level}
          mastered={units.filter((u) => u.status === "MASTERED").length}
          total={units.length}
          isLearnerLevel={level === learnerLevel}
          expanded={expanded.has(level)}
          onToggle={() => toggleLevel(level)}
        >
          {units.length === 0 ? (
            <p className="text-sm text-muted-foreground">No units at this level yet.</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {units.map((unit) => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  open={openId === unit.id}
                  starting={pending && startingId === unit.id}
                  onToggle={() => setOpenId((current) => (current === unit.id ? null : unit.id))}
                  onStart={() => startUnit(unit.id)}
                />
              ))}
            </ol>
          )}
        </LevelSection>
      ))}
    </div>
  );
}
