import { ApiError, handled } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { getLearner } from "@/lib/learner";
import { listScenarios } from "@/lib/scenarios";

export const GET = withOwner(
  handled(async () => {
    const learner = await getLearner();
    if (!learner) throw new ApiError("Learner has not completed onboarding", 409);
    return Response.json({ items: await listScenarios(learner.targetLanguage, learner.level) });
  }),
);
