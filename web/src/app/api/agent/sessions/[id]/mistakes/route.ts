import { type IdContext, idOf, readBody, withAgent } from "@/lib/api";
import { logSessionMistake, mistakeLogSchema } from "@/lib/sessions";

export const POST = withAgent(async (req, ctx: IdContext) => {
  await logSessionMistake(await idOf(ctx), await readBody(req, mistakeLogSchema));
  return Response.json({ ok: true });
});
