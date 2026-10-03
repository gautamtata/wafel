import type { Scenario } from "@/generated/prisma/client";
import type { Cefr } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { levelsUpTo } from "@/lib/levels";

export type ScenarioOption = Pick<Scenario, "id" | "title" | "description" | "minLevel">;

export function listScenarios(language: string, level: Cefr): Promise<ScenarioOption[]> {
  return db.scenario.findMany({
    where: { language, minLevel: { in: levelsUpTo(level) } },
    select: { id: true, title: true, description: true, minLevel: true },
    orderBy: [{ minLevel: "asc" }, { title: "asc" }],
  });
}
