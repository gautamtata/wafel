import { type IdContext, idOf, withAgent } from "@/lib/api";
import { getBrief } from "@/lib/sessions";

export const GET = withAgent(async (_req, ctx: IdContext) => Response.json(await getBrief(await idOf(ctx))));
