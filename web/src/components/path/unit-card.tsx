"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { MasteryRing } from "@/components/units/mastery-ring";
import { UnitStatusBadge } from "@/components/units/unit-status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GrammarNote } from "./grammar-note";
import type { PathUnit } from "./path-view";

type UnitCardProps = {
  unit: PathUnit;
  open: boolean;
  starting: boolean;
  onToggle: () => void;
  onStart: () => void;
};

export function UnitCard({ unit, open, starting, onToggle, onStart }: UnitCardProps) {
  const panelId = `unit-${unit.id}`;
  return (
    <li
      data-slot="unit-card"
      data-current={unit.isCurrent || undefined}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-card ring-1 transition-shadow",
        unit.isCurrent ? "shadow-lift ring-foreground/15" : "shadow-soft ring-foreground/5",
      )}
    >
      {unit.isCurrent && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-honey" />}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-11 w-full items-start gap-3.5 p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:gap-4 sm:p-5"
      >
        <span
          aria-hidden
          className="w-6 shrink-0 pt-0.5 font-display text-xl leading-none text-muted-foreground tabular-nums"
        >
          {unit.order}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {unit.isCurrent && <span className="eyebrow">Up next</span>}
          <span className="font-display text-lg leading-tight font-medium tracking-tight text-balance">
            {unit.title}
          </span>
          <span className="text-sm leading-relaxed text-pretty text-muted-foreground">{unit.canDo}</span>
          <span className="mt-1.5 flex items-center gap-2">
            <UnitStatusBadge status={unit.status} />
            <ChevronDown
              aria-hidden
              className={cn("size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
            />
          </span>
        </span>
        <MasteryRing mastered={unit.masteredWords} total={unit.totalWords} />
      </button>
      {open && (
        <div
          id={panelId}
          className="flex flex-col gap-5 border-t px-4 pt-4 pb-5 duration-300 animate-in fade-in slide-in-from-top-1 motion-reduce:animate-none sm:px-5 sm:pl-15"
        >
          <GrammarNote pattern={unit.pattern} />
          <Button
            type="button"
            onClick={onStart}
            disabled={starting}
            className="h-12 w-full rounded-xl px-6 text-base font-semibold shadow-[0_10px_28px_-14px_var(--honey)] sm:w-fit"
          >
            {starting ? "Setting up…" : "Start this unit"}
            {!starting && <ArrowRight data-icon="inline-end" />}
          </Button>
        </div>
      )}
    </li>
  );
}
