import { handled } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { listVocab } from "@/lib/vocab";

export const GET = withOwner(
  handled(async (req) => {
    const dueOnly = new URL(req.url).searchParams.get("due") === "1";
    return Response.json({ items: await listVocab({ dueOnly }) });
  }),
);
