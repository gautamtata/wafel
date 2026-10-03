import { withOwner } from "@/lib/auth";
import { isEnabledLanguage } from "@/lib/languages";
import { getLearner, parseLearnerUpdate, upsertLearner } from "@/lib/learner";

export const GET = withOwner(async () => {
  const learner = await getLearner();
  return learner
    ? Response.json(learner)
    : Response.json({ error: "Not onboarded" }, { status: 404 });
});

export const PUT = withOwner(async (req) => {
  const body: unknown = await req.json().catch(() => null);
  const parsed = parseLearnerUpdate(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const { targetLanguage } = parsed.data;
  if (targetLanguage && !(await isEnabledLanguage(targetLanguage))) {
    return Response.json({ error: "Language not available" }, { status: 400 });
  }
  return Response.json(await upsertLearner(parsed.data));
});
