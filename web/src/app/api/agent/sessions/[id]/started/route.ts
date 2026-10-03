import { type IdContext, idOf, noContent, withAgent } from "@/lib/api";
import { markStarted } from "@/lib/sessions";

export const POST = withAgent(async (_req, ctx: IdContext) => {
  await markStarted(await idOf(ctx));
  return noContent();
});
