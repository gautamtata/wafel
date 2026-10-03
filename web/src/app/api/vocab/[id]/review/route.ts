import { handled, type IdContext, idOf, readBody } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { gradeSchema, reviewVocab } from "@/lib/vocab";

export const POST = withOwner(
  handled(async (req, ctx: IdContext) => {
    const { grade } = await readBody(req, gradeSchema);
    return Response.json(await reviewVocab(await idOf(ctx), grade));
  }),
);
