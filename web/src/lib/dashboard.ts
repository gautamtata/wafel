import type { Cefr, SessionStatus, SessionType } from "@/generated/prisma/enums";
import { nextTopic } from "@/lib/curriculum";
import { db } from "@/lib/db";
import { getLearner, OWNER_ID } from "@/lib/learner";
import { nextUnitFor } from "@/lib/units";
import { appTimeZone, dayNumber, midnightOf, monthStartDay, weekday } from "@/lib/timezone";

export const MISTAKE_REVIEW_THRESHOLD = 3;
export const VOCAB_REVIEW_THRESHOLD = 10;
const RECENT_LIMIT = 10;
const COMPLETED: readonly SessionStatus[] = ["ENDED", "RECAP_READY"];

export type SuggestionType = "LESSON" | "MISTAKE_REVIEW" | "VOCAB_REVIEW";
export type SuggestedUnit = { id: string; title: string; canDo: string };
export type Suggestion = { type: SuggestionType; topic?: string; unit?: SuggestedUnit; reason: string };

export type RecentSession = {
  id: string;
  type: SessionType;
  status: SessionStatus;
  topic: string | null;
  scenarioTitle: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSec: number | null;
  estimatedCostCents: number | null;
};

export type SessionSource = RecentSession & { createdAt: Date };

export type DashboardView = {
  level: Cefr;
  streakDays: number;
  minutesThisWeek: number;
  wordsDue: number;
  monthSpendCents: number;
  unresolvedMistakes: number;
  currentUnit: SuggestedUnit | null;
  nextSuggestion: Suggestion;
  recentSessions: RecentSession[];
};

export type DashboardSource = {
  level: Cefr;
  sessions: SessionSource[];
  wordsDue: number;
  unresolvedMistakes: number;
  nextUnit: SuggestedUnit | null;
};

export function startOfWeek(now: Date, timeZone: string): Date {
  const sinceMonday = (weekday(now, timeZone) + 6) % 7;
  return midnightOf(dayNumber(now, timeZone) - sinceMonday, timeZone);
}

export function startOfMonth(now: Date, timeZone: string): Date {
  return midnightOf(monthStartDay(now, timeZone), timeZone);
}

export function computeStreak(dates: readonly Date[], now: Date, timeZone: string): number {
  const days = new Set(dates.map((date) => dayNumber(date, timeZone)));
  const today = dayNumber(now, timeZone);
  let cursor = days.has(today) ? today : today - 1;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

type SuggestionInput = {
  level: Cefr;
  coveredTopics: readonly string[];
  unit: SuggestedUnit | null;
  unresolvedMistakes: number;
  wordsDue: number;
};

export function pickSuggestion({
  level,
  coveredTopics,
  unit,
  unresolvedMistakes,
  wordsDue,
}: SuggestionInput): Suggestion {
  if (unresolvedMistakes >= MISTAKE_REVIEW_THRESHOLD) {
    return {
      type: "MISTAKE_REVIEW",
      reason: `${unresolvedMistakes} corrections are still open. A short review turns them into habits.`,
    };
  }
  if (wordsDue >= VOCAB_REVIEW_THRESHOLD) {
    return {
      type: "VOCAB_REVIEW",
      reason: `${wordsDue} words are due. Review them while they're still within reach.`,
    };
  }
  return {
    type: "LESSON",
    ...(unit ? { unit, topic: unit.title } : { topic: nextTopic(level, coveredTopics) }),
    reason:
      coveredTopics.length === 0
        ? `Your first ${level} lesson. About ten minutes, all spoken.`
        : `Next on your ${level} path.`,
  };
}

const completedAt = (s: SessionSource) => s.endedAt ?? s.startedAt ?? s.createdAt;

const sum = (values: readonly number[]) => values.reduce((total, n) => total + n, 0);

function toRecent(s: SessionSource): RecentSession {
  return {
    id: s.id,
    type: s.type,
    status: s.status,
    topic: s.topic,
    scenarioTitle: s.scenarioTitle,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    durationSec: s.durationSec,
    estimatedCostCents: s.estimatedCostCents,
  };
}

export function buildDashboard(
  source: DashboardSource,
  now: Date,
  timeZone: string = appTimeZone(),
): DashboardView {
  const { level, sessions, wordsDue, unresolvedMistakes, nextUnit } = source;
  const completed = sessions.filter((s) => COMPLETED.includes(s.status));
  const weekStart = startOfWeek(now, timeZone);
  const monthStart = startOfMonth(now, timeZone);

  const coveredTopics = completed
    .filter((s) => s.type === "LESSON" && s.topic)
    .map((s) => s.topic as string);

  const weekSeconds = sum(
    completed.filter((s) => completedAt(s) >= weekStart).map((s) => s.durationSec ?? 0),
  );

  return {
    level,
    streakDays: computeStreak(completed.map(completedAt), now, timeZone),
    minutesThisWeek: Math.round(weekSeconds / 60),
    wordsDue,
    monthSpendCents: sum(
      sessions.filter((s) => s.createdAt >= monthStart).map((s) => s.estimatedCostCents ?? 0),
    ),
    unresolvedMistakes,
    currentUnit: nextUnit,
    nextSuggestion: pickSuggestion({ level, coveredTopics, unit: nextUnit, unresolvedMistakes, wordsDue }),
    recentSessions: sessions
      .filter((s) => s.status !== "CREATED")
      .slice(0, RECENT_LIMIT)
      .map(toRecent),
  };
}

export async function getDashboard(now: Date = new Date()): Promise<DashboardView> {
  const [learner, next, rows, wordsDue, unresolvedMistakes] = await Promise.all([
    getLearner(),
    getLearner().then((owner) => (owner ? nextUnitFor(owner) : null)),
    db.session.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        topic: true,
        startedAt: true,
        endedAt: true,
        durationSec: true,
        estimatedCostCents: true,
        createdAt: true,
        scenario: { select: { title: true } },
      },
    }),
    db.vocabItem.count({ where: { learnerId: OWNER_ID, dueAt: { lte: now } } }),
    db.mistake.count({ where: { learnerId: OWNER_ID, resolved: false } }),
  ]);

  const sessions = rows.map(({ scenario, ...row }) => ({
    ...row,
    scenarioTitle: scenario?.title ?? null,
  }));

  return buildDashboard(
    {
      level: learner?.level ?? "A1",
      sessions,
      wordsDue,
      unresolvedMistakes,
      nextUnit: next && { id: next.id, title: next.title, canDo: next.canDo },
    },
    now,
  );
}
