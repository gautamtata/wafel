import { type IdContext, idOf, readBody, withAgent } from "@/lib/api";
import { ratingSchema, recordRating } from "@/lib/ratings";

export const POST = withAgent(async (req, ctx: IdContext) => {
  await recordRating(await idOf(ctx), await readBody(req, ratingSchema));
  return Response.json({ ok: true });
});
