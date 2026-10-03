import type { Cefr, SessionType } from "@/generated/prisma/enums";
import { levelIndex } from "@/lib/levels";

export const FREE_TALK_MIN_LEVEL: Cefr = "B1";

export type PracticeContext = { level: Cefr; unresolvedMistakes: number };

export type TypeAvailability = { disabled: false } | { disabled: true; hint: string };

export function availability(type: SessionType, ctx: PracticeContext): TypeAvailability {
  if (type === "FREE_TALK" && levelIndex(ctx.level) < levelIndex(FREE_TALK_MIN_LEVEL)) {
    return { disabled: true, hint: `Unlocks at ${FREE_TALK_MIN_LEVEL}. Lessons and role-plays get you there.` };
  }
  if (type === "MISTAKE_REVIEW" && ctx.unresolvedMistakes === 0) {
    return { disabled: true, hint: "No open corrections yet. Finish a session first." };
  }
  return { disabled: false };
}
