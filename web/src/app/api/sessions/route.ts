import { handled, readBody } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { createSession, createSessionSchema } from "@/lib/sessions";

export const POST = withOwner(
  handled(async (req) => Response.json(await createSession(await readBody(req, createSessionSchema)))),
);
