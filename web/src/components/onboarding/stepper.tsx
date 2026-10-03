"use client";

import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/app-shell/wordmark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StepMeta = { title: string; subtitle: string };

type StepperProps = {
  steps: readonly StepMeta[];
  current: number;
  canAdvance: boolean;
  pending: boolean;
  finishLabel: string;
  onBack: () => void;
  onNext: () => void;
  children: ReactNode;
};

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div aria-hidden className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-500",
            i === current ? "w-6 bg-foreground" : "w-1.5",
            i < current && "bg-foreground/45",
            i > current && "bg-foreground/15",
          )}
        />
      ))}
    </div>
  );
}

export function Stepper({
  steps,
  current,
  canAdvance,
  pending,
  finishLabel,
  onBack,
  onNext,
  children,
}: StepperProps) {
  const { title, subtitle } = steps[current];
  const isLast = current === steps.length - 1;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-[env(safe-area-inset-top)] sm:px-8">
      <header className="flex h-16 items-center justify-between">
        <Wordmark />
        <ProgressDots total={steps.length} current={current} />
      </header>

      <section
        key={current}
        className="flex-1 pt-8 pb-10 duration-500 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none sm:pt-14"
      >
        <p className="eyebrow">
          Step {current + 1} of {steps.length}
        </p>
        <h1 className="mt-3 font-display text-[2.25rem] leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 max-w-[46ch] text-pretty text-muted-foreground">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </section>

      <footer className="sticky bottom-0 -mx-5 flex gap-3 bg-linear-to-t from-background from-60% to-transparent px-5 pt-8 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:-mx-8 sm:px-8">
        {current > 0 && (
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={pending}
            className="h-12 rounded-xl px-4 text-base"
          >
            <ArrowLeft />
            Back
          </Button>
        )}
        <Button
          onClick={onNext}
          disabled={!canAdvance || pending}
          className="h-12 flex-1 rounded-xl text-base font-semibold shadow-[0_10px_28px_-14px_var(--honey)]"
        >
          {isLast ? (pending ? "Saving…" : finishLabel) : "Continue"}
        </Button>
      </footer>
    </div>
  );
}
