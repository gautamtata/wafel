import { type IdContext, idOf, readBody, withAgent } from "@/lib/api";
import { logSessionVocab, vocabLogSchema } from "@/lib/sessions";

export const POST = withAgent(async (req, ctx: IdContext) => {
  await logSessionVocab(await idOf(ctx), await readBody(req, vocabLogSchema));
  return Response.json({ ok: true });
});
