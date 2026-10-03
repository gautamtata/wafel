import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PracticePicker } from "@/components/practice/practice-picker";
import { nextTopic } from "@/lib/curriculum";
import { getLearner } from "@/lib/learner";
import { countUnresolvedMistakes } from "@/lib/mistakes";
import { listScenarios } from "@/lib/scenarios";
import { coveredTopics } from "@/lib/sessions";

export const metadata: Metadata = { title: "Practice · Wafel" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function PracticePage({ searchParams }: PageProps<"/practice">) {
  const [learner, params] = await Promise.all([getLearner(), searchParams]);
  if (!learner) redirect("/onboarding");

  const [unresolvedMistakes, covered, scenarios] = await Promise.all([
    countUnresolvedMistakes(),
    coveredTopics(),
    listScenarios(learner.targetLanguage, learner.level),
  ]);

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
        nextTopic={nextTopic(learner.level, covered)}
        scenarios={scenarios}
        initialType={first(params.type) ?? null}
      />
    </div>
  );
}
