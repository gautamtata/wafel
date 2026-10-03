import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { SuggestedUnit, Suggestion, SuggestionType } from "@/lib/dashboard";
import { PATH_HREF, practiceHref, suggestionHref } from "@/lib/links";
import { cn } from "@/lib/utils";
import { TutorPresence } from "./tutor-presence";

const COPY: Record<SuggestionType, { label: string; title?: string; cta: string }> = {
  LESSON: { label: "Lesson", cta: "Start lesson" },
  MISTAKE_REVIEW: { label: "Mistake review", title: "Revisit your mistakes", cta: "Start review" },
  VOCAB_REVIEW: { label: "Vocabulary", title: "Words due for review", cta: "Review words" },
};

const secondaryLink = (suggestion: Suggestion) =>
  suggestion.type === "LESSON"
    ? { href: PATH_HREF, label: "See your path" }
    : { href: "/practice", label: "Or choose something else" };

function CurrentUnitStrip({ unit }: { unit: SuggestedUnit }) {
  return (
    <div className="relative mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="eyebrow">Your unit</p>
        <p className="mt-1.5 font-display text-lg leading-tight font-medium tracking-tight">{unit.title}</p>
        <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{unit.canDo}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          href={practiceHref("LESSON", unit.id)}
          className={cn(buttonVariants({ variant: "outline" }), "h-11 flex-1 rounded-xl px-4 sm:flex-none")}
        >
          Start unit
        </Link>
        <Link
          href={PATH_HREF}
          className={cn(buttonVariants({ variant: "ghost" }), "h-11 flex-1 rounded-xl px-4 text-muted-foreground sm:flex-none")}
        >
          See your path
        </Link>
      </div>
    </div>
  );
}

type TodayCardProps = { suggestion: Suggestion; currentUnit: SuggestedUnit | null };

export function TodayCard({ suggestion, currentUnit }: TodayCardProps) {
  const copy = COPY[suggestion.type];
  const { unit } = suggestion;
  const secondary = secondaryLink(suggestion);
  return (
    <section
      aria-label="Today"
      className="relative overflow-hidden rounded-[1.75rem] bg-card p-6 shadow-lift ring-1 ring-foreground/5 sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 -right-20 size-72 rounded-full bg-honey/20 blur-3xl"
      />
      <div className="relative flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="eyebrow">Today · {copy.label}</p>
          <h2 className="mt-3 font-display text-[1.875rem] leading-[1.08] font-medium tracking-tight text-balance sm:text-4xl">
            {unit?.title ?? suggestion.topic ?? copy.title}
          </h2>
        </div>
        <TutorPresence className="-mt-1 -mr-1 size-16 sm:size-20" />
      </div>
      {unit && <p className="relative mt-3 max-w-[44ch] text-lg text-pretty text-foreground/85">{unit.canDo}</p>}
      <p className={cn("relative max-w-[44ch] text-pretty text-muted-foreground", unit ? "mt-1.5 text-sm" : "mt-3")}>
        {suggestion.reason}
      </p>
      <div className="relative mt-7 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href={suggestionHref(suggestion)}
          className={cn(
            buttonVariants(),
            "h-12 rounded-xl px-6 text-base font-semibold shadow-[0_10px_28px_-14px_var(--honey)]",
          )}
        >
          {copy.cta}
          <ArrowRight data-icon="inline-end" />
        </Link>
        <Link
          href={secondary.href}
          className="py-3 text-center text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          {secondary.label}
        </Link>
      </div>
      {suggestion.type !== "LESSON" && currentUnit && <CurrentUnitStrip unit={currentUnit} />}
    </section>
  );
}
