import { SessionStatus } from "@/generated/prisma/enums";
import { type IdContext, idOf, noContent, readBody, withAgent } from "@/lib/api";
import { endedSchema, markEnded, scheduleRecap } from "@/lib/sessions";

export const POST = withAgent(async (req, ctx: IdContext) => {
  const { transcript, durationSec } = await readBody(req, endedSchema);
  const id = await idOf(ctx);
  const { status, changed } = await markEnded(id, transcript, durationSec);
  if (changed && status === SessionStatus.ENDED) scheduleRecap(id);
  return noContent();
});
