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

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

export function formatSpan(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE_MS));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(ms / HOUR_MS);
  if (hours < 24) return `${hours} hr`;
  const days = Math.round(ms / DAY_MS);
  if (days < 30) return plural(days, "day");
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${Math.round(days / 365)} yr`;
}

export function formatDueIn(dueAt: Date, now: Date): string {
  const ms = dueAt.getTime() - now.getTime();
  return ms <= 0 ? "Due now" : `in ${formatSpan(ms)}`;
}
