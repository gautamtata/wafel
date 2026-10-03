import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app-shell/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { type ReviewCard, ReviewDeck } from "@/components/vocab/review-deck";
import { VocabTable } from "@/components/vocab/vocab-table";
import { formatDueIn } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listVocab } from "@/lib/vocab";

export const metadata: Metadata = { title: "Vocabulary · Wafel" };

const words = (n: number) => `${n} ${n === 1 ? "word" : "words"}`;

export default async function VocabPage() {
  const now = new Date();
  const items = await listVocab();
  const due = items.filter((item) => item.dueAt <= now);
  const nextDue = items.find((item) => item.dueAt > now);
  const cards: ReviewCard[] = due.map(({ id, word, translation, example, ease, intervalDays, reps }) => ({
    id,
    word,
    translation,
    example,
    ease,
    intervalDays,
    reps,
  }));

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-10">
        <PageHeader title="Vocabulary" subtitle="Words you pick up in sessions." />
        <EmptyState
          icon={BookOpen}
          title="Your deck is empty"
          actions={
            <Link href="/practice" className={cn(buttonVariants(), "h-11 rounded-xl px-5 text-base font-semibold")}>
              Start a session
            </Link>
          }
        >
          New words from your sessions land here, ready to review the next day.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={`${words(items.length)} in your deck`}
        title="Vocabulary"
        subtitle={due.length > 0 ? `${words(due.length)} due for review.` : "You're all caught up."}
      />
      <ReviewDeck cards={cards} nextDueLabel={nextDue ? formatDueIn(nextDue.dueAt, now) : null} />
      <section aria-labelledby="all-words" className="flex flex-col gap-4">
        <h2 id="all-words" className="font-display text-2xl font-medium tracking-tight">
          All words
        </h2>
        <VocabTable items={items} now={now} />
      </section>
    </div>
  );
}
