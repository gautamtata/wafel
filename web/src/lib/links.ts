import type { SessionStatus } from "@/generated/prisma/enums";
import type { Suggestion } from "@/lib/dashboard";

export function suggestionHref({ type, topic }: Suggestion): string {
  if (type === "VOCAB_REVIEW") return "/vocab";
  const params = new URLSearchParams({ type });
  if (topic) params.set("topic", topic);
  return `/practice?${params}`;
}

const RECAP_STATUSES: readonly SessionStatus[] = ["ENDED", "RECAP_READY", "FAILED"];

export function hasRecapPage(status: SessionStatus): boolean {
  return RECAP_STATUSES.includes(status);
}

export function sessionHref(id: string, status: SessionStatus): string {
  return hasRecapPage(status) ? `/session/${id}/recap` : `/session/${id}`;
}

export const MISTAKE_PRACTICE_HREF = "/practice?type=MISTAKE_REVIEW";
