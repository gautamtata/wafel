import { Clock3, Coffee, Coins, Flame, Layers } from "lucide-react";
import type { DashboardView } from "@/lib/dashboard";
import { formatCents } from "@/lib/format";
import { LEVEL_DESCRIPTORS } from "@/lib/prompts-meta";
import { Greeting } from "./greeting";
import { SessionRow } from "./session-row";
import { StatTile } from "./stat-tile";
import { TodayCard } from "./today-card";

function EmptySessions() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-foreground/70">
        <Coffee className="size-5" strokeWidth={1.75} />
      </span>
      <p className="mt-4 font-display text-xl font-medium tracking-tight">Nothing here yet</p>
      <p className="mt-1.5 max-w-[36ch] text-sm text-pretty text-muted-foreground">
        Your sessions will collect here. Each one ends with a recap: corrections, new words and a
        note on your level.
      </p>
    </div>
  );
}

export function Dashboard({ view, now }: { view: DashboardView; now: Date }) {
  const { level, streakDays, minutesThisWeek, wordsDue, monthSpendCents, recentSessions } = view;
  return (
    <div className="flex flex-col gap-10">
      <Greeting subtitle={`Level ${level} · ${LEVEL_DESCRIPTORS[level].title}`} />
      <TodayCard suggestion={view.nextSuggestion} />

      <section aria-label="Your progress" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Streak"
          value={String(streakDays)}
          unit={streakDays === 1 ? "day" : "days"}
          icon={Flame}
        />
        <StatTile label="This week" value={String(minutesThisWeek)} unit="min" icon={Clock3} />
        <StatTile label="Words due" value={String(wordsDue)} icon={Layers} href="/vocab" />
        <StatTile label="This month" value={formatCents(monthSpendCents)} icon={Coins} />
      </section>

      <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
        <h2 id="recent-heading" className="font-display text-2xl font-medium tracking-tight">
          Recent sessions
        </h2>
        {recentSessions.length === 0 ? (
          <EmptySessions />
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-foreground/5">
            {recentSessions.map((session) => (
              <li key={session.id}>
                <SessionRow session={session} now={now} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
