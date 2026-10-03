import { handled, type IdContext, idOf, noContent } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { deleteVocab } from "@/lib/vocab";

export const DELETE = withOwner(
  handled(async (_req, ctx: IdContext) => {
    await deleteVocab(await idOf(ctx));
    return noContent();
  }),
);
