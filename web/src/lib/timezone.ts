export const DEFAULT_TIME_ZONE = "America/Los_Angeles";

const DAY_MS = 86_400_000;

export function appTimeZone(): string {
  return process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE;
}

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function wallClock(date: Date, timeZone: string): WallClock {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return parts as WallClock;
}

/** Calendar day number in `timeZone` (days since the Unix epoch). */
export function dayNumber(date: Date, timeZone: string): number {
  const { year, month, day } = wallClock(date, timeZone);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/** Day of week in `timeZone`, 0 = Sunday. */
export function weekday(date: Date, timeZone: string): number {
  return (dayNumber(date, timeZone) + 4) % 7;
}

function offsetMs(instant: number, timeZone: string): number {
  const { year, month, day, hour, minute, second } = wallClock(new Date(instant), timeZone);
  return Date.UTC(year, month - 1, day, hour, minute, second) - Math.floor(instant / 1000) * 1000;
}

/** The instant midnight begins on calendar day `day` in `timeZone`. */
export function midnightOf(day: number, timeZone: string): Date {
  const utcMidnight = day * DAY_MS;
  const guess = utcMidnight - offsetMs(utcMidnight, timeZone);
  return new Date(utcMidnight - offsetMs(guess, timeZone));
}

export function monthStartDay(date: Date, timeZone: string): number {
  const { year, month } = wallClock(date, timeZone);
  return Date.UTC(year, month - 1, 1) / DAY_MS;
}
