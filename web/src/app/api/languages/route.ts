import { withOwner } from "@/lib/auth";
import { listLanguages } from "@/lib/languages";

export const GET = withOwner(async () => Response.json(await listLanguages()));
