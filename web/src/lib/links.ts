import type { SessionStatus } from "@/generated/prisma/enums";
import type { Suggestion } from "@/lib/dashboard";

export function suggestionHref({ type, topic }: Suggestion): string {
  if (type === "VOCAB_REVIEW") return "/vocab";
  const params = new URLSearchParams({ type });
  if (topic) params.set("topic", topic);
  return `/practice?${params}`;
}

export function sessionHref(id: string, status: SessionStatus): string {
  return status === "RECAP_READY" ? `/session/${id}/recap` : `/session/${id}`;
}

export const MISTAKE_PRACTICE_HREF = "/practice?type=MISTAKE_REVIEW";
