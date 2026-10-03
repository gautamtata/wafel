import { handled } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { listMistakes } from "@/lib/mistakes";

export const GET = withOwner(handled(async () => Response.json({ items: await listMistakes() })));
