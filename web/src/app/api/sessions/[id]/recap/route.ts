import { handled, type IdContext, idOf } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { generateAndStoreRecap, getSessionView } from "@/lib/sessions";

export const POST = withOwner(
  handled(async (_req, ctx: IdContext) => {
    const id = await idOf(ctx);
    await generateAndStoreRecap(id);
    return Response.json(await getSessionView(id));
  }),
);
