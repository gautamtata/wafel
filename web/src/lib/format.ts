import { appTimeZone, dayNumber } from "@/lib/timezone";

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  return seconds < 60 ? "<1 min" : `${Math.round(seconds / 60)} min`;
}

export function formatDay(date: Date, now: Date, timeZone: string = appTimeZone()): string {
  const daysAgo = dayNumber(now, timeZone) - dayNumber(date, timeZone);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}
