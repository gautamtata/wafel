"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import type { Cefr } from "@/generated/prisma/enums";
import { LEVEL_DESCRIPTORS } from "@/lib/prompts-meta";
import { cn } from "@/lib/utils";

type LevelSectionProps = {
  level: Cefr;
  mastered: number;
  total: number;
  isLearnerLevel: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function LevelSection({
  level,
  mastered,
  total,
  isLearnerLevel,
  expanded,
  onToggle,
  children,
}: LevelSectionProps) {
  const headingId = `level-${level}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 border-b pb-3">
        <div className="min-w-0">
          <h2 id={headingId} className="flex items-baseline gap-2.5 font-display text-2xl font-medium tracking-tight">
            {level}
            <span className="font-sans text-sm font-medium text-muted-foreground">{LEVEL_DESCRIPTORS[level].title}</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {isLearnerLevel ? "Your level · " : ""}
            {mastered} of {total} mastered
          </p>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} ${level} units`}
          onClick={onToggle}
          className="-mr-2 flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {expanded ? "Hide" : "Show"}
          <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200", expanded && "rotate-180")} />
        </button>
      </div>
      {expanded && children}
    </section>
  );
}
