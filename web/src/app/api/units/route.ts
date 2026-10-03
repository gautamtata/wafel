import { Cefr } from "@/generated/prisma/enums";
import { badRequest, handled } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { requireLearner } from "@/lib/learner";
import { listUnitSummaries } from "@/lib/unit-progress";

const LEVELS = Object.values(Cefr) as string[];

export const GET = withOwner(
  handled(async (req) => {
    const learner = await requireLearner();
    const requested = new URL(req.url).searchParams.get("level");
    if (requested !== null && !LEVELS.includes(requested)) throw badRequest("Invalid level");
    const level = (requested as Cefr | null) ?? learner.level;
    return Response.json({ level, units: await listUnitSummaries(learner, [level]) });
  }),
);
