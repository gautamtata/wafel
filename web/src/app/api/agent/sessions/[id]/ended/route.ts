import { type IdContext, idOf, noContent, readBody, withAgent } from "@/lib/api";
import { endedSchema, endSessionAndRecap } from "@/lib/sessions";

export const POST = withAgent(async (req, ctx: IdContext) => {
  const { transcript, durationSec } = await readBody(req, endedSchema);
  await endSessionAndRecap(await idOf(ctx), transcript, durationSec);
  return noContent();
});
