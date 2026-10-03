import { handled, type IdContext, idOf } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { getSessionView } from "@/lib/sessions";

export const GET = withOwner(
  handled(async (_req, ctx: IdContext) => Response.json(await getSessionView(await idOf(ctx)))),
);
