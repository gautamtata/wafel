import { cn } from "@/lib/utils";

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type MasteryRingProps = { mastered: number; total: number; className?: string };

export function MasteryRing({ mastered, total, className }: MasteryRingProps) {
  const ratio = total > 0 ? Math.min(mastered / total, 1) : 0;
  return (
    <span
      role="img"
      aria-label={`${mastered} of ${total} words mastered`}
      className={cn("relative inline-flex size-12 shrink-0 items-center justify-center", className)}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={RADIUS} fill="none" strokeWidth="3.5" className="stroke-muted" />
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
          className={cn("stroke-foreground transition-[stroke-dashoffset] duration-700", ratio === 0 && "opacity-0")}
        />
      </svg>
      <span aria-hidden className="text-[0.6875rem] font-semibold tabular-nums">
        {mastered}
        <span className="text-muted-foreground">/{total}</span>
      </span>
    </span>
  );
}
