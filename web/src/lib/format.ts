const DAY_MS = 86_400_000;

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  return seconds < 60 ? "<1 min" : `${Math.round(seconds / 60)} min`;
}

const dayStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function formatDay(date: Date, now: Date): string {
  const daysAgo = Math.round((dayStart(now) - dayStart(date)) / DAY_MS);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return SHORT_DATE.format(date);
}
