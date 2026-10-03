import { z } from "zod";
import { handled, type IdContext, idOf, readBody } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { setMistakeResolved } from "@/lib/mistakes";

const patchSchema = z.object({ resolved: z.boolean() });

export const PATCH = withOwner(
  handled(async (req, ctx: IdContext) => {
    const { resolved } = await readBody(req, patchSchema);
    return Response.json(await setMistakeResolved(await idOf(ctx), resolved));
  }),
);
