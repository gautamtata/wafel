import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { MasteryRing } from "@/components/units/mastery-ring";
import { ScorePips } from "@/components/units/score-pips";
import { UnitStatusBadge } from "@/components/units/unit-status-badge";
import { PATH_HREF } from "@/lib/links";
import type { RecapUnit } from "@/lib/types";
import { unitLevelOf } from "@/lib/unit-schema";

const inlineLink = "font-medium text-foreground underline underline-offset-4 hover:decoration-honey";

function NextStepLine({ unit }: { unit: RecapUnit }) {
  const { unitId, title, raiseLevelSuggested } = unit.nextStep;
  if (!unitId || !title) return <p>You&apos;ve finished every unit on your path. ¡Felicidades!</p>;
  return (
    <p className="text-pretty">
      {unitId === unit.id ? `Keep going with ${title} next time.` : `Next up: ${title}.`}
      {raiseLevelSuggested && (
        <>
          {" "}
          Consider moving up to {unitLevelOf({ id: unitId })}.{" "}
          <Link href="/settings" className={inlineLink}>
            Change level
          </Link>
        </>
      )}
    </p>
  );
}

export function UnitRecap({ unit }: { unit: RecapUnit }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-foreground/5">
      <div className="flex items-center gap-4 p-5 sm:p-6">
        <MasteryRing mastered={unit.masteredWords} total={unit.totalWords} className="size-14" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-tight font-medium tracking-tight text-balance">{unit.title}</p>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {unit.masteredWords} of {unit.totalWords} words mastered
          </p>
        </div>
        <UnitStatusBadge status={unit.status} />
      </div>

      <div className="border-t">
        <div className="flex items-baseline justify-between px-5 pt-3.5 pb-1.5 sm:px-6">
          <p className="eyebrow">Words practised</p>
          <p className="eyebrow">Best so far</p>
        </div>
        {unit.wordsRated.length === 0 ? (
          <p className="px-5 pb-4 text-sm text-muted-foreground sm:px-6">No words were rated this time.</p>
        ) : (
          <ul className="flex flex-col pb-2">
            {unit.wordsRated.map(({ word, best }) => (
              <li key={word} className="flex min-h-11 items-center justify-between gap-4 px-5 sm:px-6">
                <span lang="es" className="font-medium">
                  {word}
                </span>
                <ScorePips score={best} label={`${word}, best so far`} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex min-h-14 items-center justify-between gap-4 border-t px-5 sm:px-6">
        <span className="text-sm font-medium">Grammar pattern</span>
        <ScorePips score={unit.patternScore} label="Grammar pattern" />
      </div>

      <div className="flex flex-col gap-2 border-t bg-muted/40 px-5 py-4 text-sm sm:px-6">
        <NextStepLine unit={unit} />
        <Link href={PATH_HREF} className="flex w-fit items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
          See your path
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
