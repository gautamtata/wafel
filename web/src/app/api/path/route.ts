import { handled } from "@/lib/api";
import { withOwner } from "@/lib/auth";
import { requireLearner } from "@/lib/learner";
import { pathFor } from "@/lib/unit-progress";

export const GET = withOwner(handled(async () => Response.json(await pathFor(await requireLearner()))));
