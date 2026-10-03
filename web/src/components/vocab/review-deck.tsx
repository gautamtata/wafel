"use client";

import { CalendarCheck, PartyPopper } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app-shell/empty-state";
import { Button } from "@/components/ui/button";
import type { VocabItem } from "@/generated/prisma/client";
import { send } from "@/lib/client-fetch";
import { formatSpan } from "@/lib/format";
import { type Grade, review } from "@/lib/srs";
import { cn } from "@/lib/utils";

export type ReviewCard = Pick<
  VocabItem,
  "id" | "word" | "translation" | "example" | "ease" | "intervalDays" | "reps"
>;

const GRADES: readonly { grade: Grade; label: string; key: string }[] = [
  { grade: 0, label: "Again", key: "1" },
  { grade: 1, label: "Hard", key: "2" },
  { grade: 2, label: "Good", key: "3" },
  { grade: 3, label: "Easy", key: "4" },
];

const EPOCH = new Date(0);

const nextInterval = (card: ReviewCard, grade: Grade) =>
  formatSpan(review({ ...card, dueAt: EPOCH }, grade, EPOCH).dueAt.getTime());

const INTERACTIVE = "a,button,input,textarea,select,[role=button],[role=switch],[contenteditable]";

const ownsKeys = (target: EventTarget | null) =>
  target instanceof Element && target.closest(INTERACTIVE) !== null;

function Face({ hidden, className, children }: { hidden: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={hidden}
      className={cn(
        "col-start-1 row-start-1 flex min-h-64 flex-col items-center justify-center rounded-[1.75rem] bg-card px-6 py-10 text-center shadow-lift ring-1 ring-foreground/5 backface-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Flashcard({ card, revealed, onReveal }: { card: ReviewCard; revealed: boolean; onReveal: () => void }) {
  return (
    <div className="perspective-[1400px]" onClick={onReveal}>
      <div
        className={cn(
          "grid transition-transform duration-500 ease-out transform-3d motion-reduce:transition-none",
          revealed ? "rotate-y-180" : "cursor-pointer",
        )}
      >
        <Face hidden={revealed}>
          <p className="font-display text-[2.5rem] leading-tight font-medium tracking-tight text-balance sm:text-5xl">
            {card.word}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">What does it mean?</p>
        </Face>
        <Face hidden={!revealed} className="rotate-y-180">
          {revealed && (
            <>
              <p className="text-sm font-medium text-muted-foreground">{card.word}</p>
              <p className="mt-2 font-display text-[2rem] leading-tight font-medium tracking-tight text-balance sm:text-4xl">
                {card.translation}
              </p>
              {card.example && (
                <p className="mt-5 max-w-[34ch] text-pretty text-muted-foreground italic">{card.example}</p>
              )}
            </>
          )}
        </Face>
      </div>
    </div>
  );
}

type ReviewDeckProps = { cards: ReviewCard[]; nextDueLabel: string | null };

export function ReviewDeck({ cards, nextDueLabel }: ReviewDeckProps) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const current = queue[0];

  const grade = useCallback(
    (card: ReviewCard, value: Grade) => {
      setQueue((q) => (value === 0 ? [...q.slice(1), card] : q.slice(1)));
      setRevealed(false);
      setReviewed((n) => n + 1);
      send(`/api/vocab/${card.id}/review`, "POST", { grade: value }).catch(() => {
        toast.error(`Couldn't save your review of “${card.word}”. It's back in the deck.`);
        setReviewed((n) => n - 1);
        setQueue((q) => (q.some((c) => c.id === card.id) ? q : [...q, card]));
      });
    },
    [],
  );

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || ownsKeys(event.target)) return;
      if (!revealed && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      const match = revealed && GRADES.find((g) => g.key === event.key);
      if (match) grade(current, match.grade);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, grade]);

  const finished = !current && reviewed > 0;
  useEffect(() => {
    if (finished) router.refresh();
  }, [finished, router]);

  if (!current) {
    return finished ? (
      <EmptyState icon={PartyPopper} title="All caught up">
        You reviewed {reviewed} {reviewed === 1 ? "card" : "cards"}.{" "}
        {nextDueLabel ? `Next word is due ${nextDueLabel}.` : "See you next session."}
      </EmptyState>
    ) : (
      <EmptyState icon={CalendarCheck} title="Nothing due. Come back tomorrow.">
        {nextDueLabel ? `Next word is due ${nextDueLabel}.` : "Every word is scheduled for later."}
      </EmptyState>
    );
  }

  const total = reviewed + queue.length;
  return (
    <section aria-label="Review" className="flex flex-col gap-5">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {queue.length} left
        </span>
        <div
          role="progressbar"
          aria-label="Review progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={reviewed}
          className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-foreground/70 transition-[width] duration-500"
            style={{ width: `${(reviewed / total) * 100}%` }}
          />
        </div>
      </div>

      <Flashcard key={`${current.id}-${reviewed}`} card={current} revealed={revealed} onReveal={() => setRevealed(true)} />

      {revealed ? (
        <div role="group" aria-label="How well did you know it?" className="grid grid-cols-4 gap-2">
          {GRADES.map(({ grade: value, label, key }) => (
            <Button
              key={label}
              variant="outline"
              onClick={() => grade(current, value)}
              className="h-auto min-h-14 flex-col gap-0.5 rounded-xl bg-card py-2.5 text-base font-semibold"
            >
              {label}
              <span className="text-xs font-normal text-muted-foreground">
                {nextInterval(current, value)}
                <kbd className="ml-1.5 hidden font-sans text-muted-foreground/60 md:inline">{key}</kbd>
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <Button
          onClick={() => setRevealed(true)}
          className="h-14 rounded-xl text-base font-semibold shadow-[0_10px_28px_-14px_var(--honey)]"
        >
          Show answer
        </Button>
      )}
      <p className="hidden text-center text-xs text-muted-foreground md:block">
        Space to reveal · 1–4 to grade
      </p>
    </section>
  );
}
