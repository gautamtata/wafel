import { cn } from "@/lib/utils";

export const MAX_SCORE = 3;

type ScorePipsProps = { score: number; label: string; className?: string };

export function ScorePips({ score, label, className }: ScorePipsProps) {
  return (
    <span
      role="img"
      aria-label={`${label}: ${score} of ${MAX_SCORE}`}
      className={cn("inline-flex shrink-0 items-center gap-1", className)}
    >
      {Array.from({ length: MAX_SCORE }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "size-2 rounded-full transition-colors",
            i < score ? "bg-foreground" : "bg-foreground/12 ring-1 ring-foreground/10 ring-inset",
          )}
        />
      ))}
    </span>
  );
}
