import { Sparkles } from "lucide-react";
import { CategoryBadge, Correction } from "@/components/mistakes/correction";
import type { RecapMistake } from "@/lib/types";

export function MistakeList({ mistakes }: { mistakes: RecapMistake[] }) {
  if (mistakes.length === 0) {
    return (
      <p className="flex items-center gap-3 rounded-2xl bg-card px-5 py-4 text-muted-foreground shadow-soft ring-1 ring-foreground/5">
        <Sparkles className="size-4 shrink-0 text-foreground/70" strokeWidth={1.75} />
        No corrections this time. ¡Muy bien!
      </p>
    );
  }
  return (
    <ul className="divide-y overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-foreground/5">
      {mistakes.map((mistake) => (
        <li key={mistake.original} className="flex flex-col gap-2 px-5 py-4 sm:px-6">
          <CategoryBadge category={mistake.category} />
          <Correction original={mistake.original} corrected={mistake.corrected} />
          {mistake.explanation && (
            <p className="text-sm text-pretty text-muted-foreground">{mistake.explanation}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
