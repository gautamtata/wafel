import type { SessionStatus, SessionType } from "@/generated/prisma/enums";
import type { Suggestion } from "@/lib/dashboard";

export const PATH_HREF = "/path";

export function practiceHref(type: SessionType, unitId?: string): string {
  const params = new URLSearchParams({ type });
  if (unitId) params.set("unitId", unitId);
  return `/practice?${params}`;
}

export function suggestionHref({ type, unit }: Suggestion): string {
  return type === "VOCAB_REVIEW" ? "/vocab" : practiceHref(type, unit?.id);
}

const RECAP_STATUSES: readonly SessionStatus[] = ["ENDED", "RECAP_READY", "FAILED"];

export function hasRecapPage(status: SessionStatus): boolean {
  return RECAP_STATUSES.includes(status);
}

export function sessionHref(id: string, status: SessionStatus): string {
  return hasRecapPage(status) ? `/session/${id}/recap` : `/session/${id}`;
}

export const MISTAKE_PRACTICE_HREF = "/practice?type=MISTAKE_REVIEW";
