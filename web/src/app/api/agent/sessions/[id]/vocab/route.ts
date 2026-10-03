import { type IdContext, idOf, readBody, withAgent } from "@/lib/api";
import { logSessionVocab } from "@/lib/sessions";
import { vocabLogSchema } from "@/lib/vocab";

export const POST = withAgent(async (req, ctx: IdContext) => {
  await logSessionVocab(await idOf(ctx), await readBody(req, vocabLogSchema));
  return Response.json({ ok: true });
});
