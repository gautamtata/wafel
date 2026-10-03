import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PracticePicker } from "@/components/practice/practice-picker";
import { getLearner } from "@/lib/learner";
import { countUnresolvedMistakes } from "@/lib/mistakes";
import { listScenarios } from "@/lib/scenarios";
import { listUnitSummaries, neighbouringLevels } from "@/lib/unit-progress";

export const metadata: Metadata = { title: "Practice · Wafel" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function PracticePage({ searchParams }: PageProps<"/practice">) {
  const [learner, params] = await Promise.all([getLearner(), searchParams]);
  if (!learner) redirect("/onboarding");

  const [unresolvedMistakes, summaries, scenarios] = await Promise.all([
    countUnresolvedMistakes(),
    listUnitSummaries(learner, neighbouringLevels(learner.level)),
    listScenarios(learner.targetLanguage, learner.level),
  ]);

  const current = summaries.find((unit) => unit.isCurrent) ?? null;
  const requested = summaries.find((unit) => unit.id === first(params.unitId));
  const initial = requested ?? current;
  const units = summaries.filter((unit) => unit.level === learner.level || unit.id === initial?.id);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-[2.75rem] leading-none font-medium tracking-tight sm:text-6xl">
          Practice
        </h1>
        <p className="mt-3 text-muted-foreground">Pick a session. Your tutor is ready when you are.</p>
      </header>
      <PracticePicker
        context={{ level: learner.level, unresolvedMistakes }}
        units={units}
        currentUnitId={current?.id ?? null}
        initialUnitId={initial?.id ?? null}
        scenarios={scenarios}
        initialType={first(params.type) ?? null}
      />
    </div>
  );
}
