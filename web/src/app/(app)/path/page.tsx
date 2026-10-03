import { Map as MapIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/app-shell/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";
import { type PathLevel, PathView } from "@/components/path/path-view";
import { buttonVariants } from "@/components/ui/button";
import { getLearner } from "@/lib/learner";
import { LEVEL_DESCRIPTORS } from "@/lib/prompts-meta";
import { pathFor } from "@/lib/unit-progress";
import { listUnits, unitContent } from "@/lib/units";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Path · Wafel" };

export default async function PathPage() {
  const learner = await getLearner();
  if (!learner) redirect("/onboarding");

  const [path, units] = await Promise.all([
    pathFor(learner),
    listUnits({ language: learner.targetLanguage, dialect: learner.dialect }),
  ]);
  const patterns = new Map(units.map((unit) => [unit.id, unitContent(unit).pattern]));
  const levels: PathLevel[] = path.levels.map(({ level, units: summaries }) => ({
    level,
    units: summaries.flatMap((summary) => {
      const pattern = patterns.get(summary.id);
      return pattern ? [{ ...summary, pattern }] : [];
    }),
  }));
  const current = levels.flatMap((l) => l.units).find((u) => u.isCurrent);
  const empty = levels.every((l) => l.units.length === 0);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow={`Level ${learner.level} · ${LEVEL_DESCRIPTORS[learner.level].title}`}
        title="Your path"
        subtitle={
          empty
            ? "Units teach a handful of words and one grammar pattern each."
            : current
              ? `Next up: ${current.title}. Tap any unit to read its grammar note.`
              : "Every unit here is mastered. Raise your level in settings when you're ready."
        }
      />
      {empty ? (
        <EmptyState
          icon={MapIcon}
          title="No units for this variety yet"
          actions={
            <Link href="/settings" className={cn(buttonVariants(), "h-11 rounded-xl px-5 text-base font-semibold")}>
              Open settings
            </Link>
          }
        >
          The unit path is written in Mexican Spanish. Switch your Spanish variety to Mexico to follow it.
        </EmptyState>
      ) : (
        <PathView learnerLevel={learner.level} levels={levels} />
      )}
    </div>
  );
}
