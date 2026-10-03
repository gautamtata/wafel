import { handled, type IdContext, idOf, noContent, readBody } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { failedSchema, markFailed } from "@/lib/sessions";

export const POST = withOwner(
  handled(async (req, ctx: IdContext) => {
    const { reason } = await readBody(req, failedSchema);
    await markFailed(await idOf(ctx), reason);
    return noContent();
  }),
);
