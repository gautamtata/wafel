import { type IdContext, idOf, noContent, readBody, withAgent } from "@/lib/api";
import { failedSchema, markFailed } from "@/lib/sessions";

export const POST = withAgent(async (req, ctx: IdContext) => {
  const { reason } = await readBody(req, failedSchema);
  await markFailed(await idOf(ctx), reason);
  return noContent();
});
