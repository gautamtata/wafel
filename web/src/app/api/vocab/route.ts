import { handled, readBody } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { addVocab, addVocabSchema, listVocab } from "@/lib/vocab";

export const GET = withOwner(
  handled(async (req) => {
    const dueOnly = new URL(req.url).searchParams.get("due") === "1";
    return Response.json({ items: await listVocab({ dueOnly }) });
  }),
);

export const POST = withOwner(
  handled(async (req) => Response.json(await addVocab(await readBody(req, addVocabSchema)), { status: 201 })),
);
