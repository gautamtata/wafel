import { CalendarDays, Clock3, Coins, type LucideIcon } from "lucide-react";
import { formatCents, formatDay, formatDuration } from "@/lib/format";

type CostLineProps = {
  durationSec: number | null;
  costCents: number | null;
  date: Date | null;
  now: Date;
};

export function CostLine({ durationSec, costCents, date, now }: CostLineProps) {
  const parts: [LucideIcon, string, string | null][] = [
    [CalendarDays, "Date", date && formatDay(date, now)],
    [Clock3, "Duration", formatDuration(durationSec)],
    [Coins, "Estimated cost", costCents === null ? null : formatCents(costCents)],
  ];
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
      {parts.map(
        ([Icon, label, value]) =>
          value && (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="flex items-center gap-1.5 tabular-nums">
                <Icon aria-hidden className="size-3.5" strokeWidth={2} />
                {value}
              </dd>
            </div>
          ),
      )}
    </dl>
  );
}
