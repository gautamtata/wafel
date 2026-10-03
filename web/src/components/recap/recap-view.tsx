import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { MISTAKE_PRACTICE_HREF } from "@/lib/links";
import { SESSION_TYPE_LABELS } from "@/lib/session-labels";
import type { SessionView } from "@/lib/sessions";
import type { Recap } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CostLine } from "./cost-line";
import { LevelNote } from "./level-note";
import { MistakeList } from "./mistake-list";
import { RecapSection } from "./recap-section";
import { UnitRecap } from "./unit-recap";
import { type PickWord, VocabPicks } from "./vocab-picks";

type RecapViewProps = { session: SessionView; recap: Recap; words: PickWord[]; now: Date };

export function RecapView({ session, recap, words, now }: RecapViewProps) {
  const typeLabel = SESSION_TYPE_LABELS[session.type];
  const title = session.topic ?? session.scenarioTitle ?? typeLabel;
  const hasMistakes = recap.mistakes.length > 0;

  return (
    <article className="flex flex-col gap-12">
      <header className="flex flex-col gap-5">
        <div>
          <p className="eyebrow">Recap · {typeLabel}</p>
          <h1 className="mt-2 font-display text-[2.5rem] leading-[1.02] font-medium tracking-tight text-balance sm:text-[3.25rem]">
            {title}
            <span className="text-honey">.</span>
          </h1>
        </div>
        <CostLine
          durationSec={session.durationSec}
          costCents={session.estimatedCostCents}
          date={session.endedAt ?? session.startedAt}
          now={now}
        />
        <p className="font-display text-[1.375rem] leading-[1.4] text-pretty text-foreground/85 sm:text-2xl">
          {recap.summary}
        </p>
        {recap.nextStep && (
          <p className="flex gap-3 rounded-2xl bg-accent/50 px-4 py-3.5 text-pretty">
            <span className="eyebrow shrink-0 pt-0.5">Next time</span>
            <span>{recap.nextStep}</span>
          </p>
        )}
      </header>

      {recap.unit && (
        <RecapSection id="this-unit" title="This unit">
          <UnitRecap unit={recap.unit} />
        </RecapSection>
      )}

      <RecapSection id="corrections" title="Corrections" count={recap.mistakes.length}>
        <MistakeList mistakes={recap.mistakes} />
      </RecapSection>

      <RecapSection id="new-words" title="New words" count={words.length}>
        <VocabPicks words={words} sessionId={session.id} />
      </RecapSection>

      {recap.levelNote && <LevelNote note={recap.levelNote} />}

      <nav aria-label="Next" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Link
          href={hasMistakes ? MISTAKE_PRACTICE_HREF : "/practice"}
          className={cn(
            buttonVariants(),
            "h-12 rounded-xl px-6 text-base font-semibold shadow-[0_10px_28px_-14px_var(--honey)]",
          )}
        >
          {hasMistakes ? "Practice these mistakes" : "Start another session"}
          <ArrowRight data-icon="inline-end" />
        </Link>
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-xl px-6 text-base")}>
          Home
        </Link>
      </nav>
    </article>
  );
}
