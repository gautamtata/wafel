import {
  ChevronRight,
  Drama,
  GraduationCap,
  type LucideIcon,
  MessagesSquare,
  PenLine,
  Repeat2,
} from "lucide-react";
import Link from "next/link";
import type { SessionType } from "@/generated/prisma/enums";
import type { RecentSession } from "@/lib/dashboard";
import { formatCents, formatDay, formatDuration } from "@/lib/format";
import { sessionHref } from "@/lib/links";
import { SESSION_STATUS_NOTES, SESSION_TYPE_LABELS } from "@/lib/session-labels";

const TYPE_ICONS: Record<SessionType, LucideIcon> = {
  SHADOWING: Repeat2,
  LESSON: GraduationCap,
  ROLEPLAY: Drama,
  FREE_TALK: MessagesSquare,
  MISTAKE_REVIEW: PenLine,
};

export function SessionRow({ session, now }: { session: RecentSession; now: Date }) {
  const Icon = TYPE_ICONS[session.type];
  const typeLabel = SESSION_TYPE_LABELS[session.type];
  const title = session.topic ?? session.scenarioTitle ?? typeLabel;
  const when = session.startedAt ?? session.endedAt;
  const note = SESSION_STATUS_NOTES[session.status];
  const meta = [
    title === typeLabel ? null : typeLabel,
    when && formatDay(when, now),
    formatDuration(session.durationSec),
    session.estimatedCostCents === null ? null : formatCents(session.estimatedCostCents),
  ].filter(Boolean);

  return (
    <Link
      href={sessionHref(session.id, session.status)}
      className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/75">
        <Icon className="size-[1.1rem]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{title}</span>
          {note && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
              {note}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted-foreground">
          {meta.join(" · ")}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
