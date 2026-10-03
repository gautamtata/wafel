import type { SessionStatus, SessionType } from "@/generated/prisma/enums";

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  SHADOWING: "Shadowing",
  LESSON: "Lesson",
  ROLEPLAY: "Role-play",
  FREE_TALK: "Free talk",
  MISTAKE_REVIEW: "Mistake review",
};

export const SESSION_STATUS_NOTES: Partial<Record<SessionStatus, string>> = {
  ACTIVE: "In progress",
  ENDED: "Recap pending",
  FAILED: "Didn't connect",
};

type Titled = { type: SessionType; topic: string | null; scenarioTitle: string | null };

export function sessionTitle({ type, topic, scenarioTitle }: Titled): string {
  return topic ?? scenarioTitle ?? SESSION_TYPE_LABELS[type];
}
