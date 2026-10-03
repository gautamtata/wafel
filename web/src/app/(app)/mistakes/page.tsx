import { ArrowRight, PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app-shell/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";
import { MistakeGroup, type MistakeRow } from "@/components/mistakes/mistake-group";
import { buttonVariants } from "@/components/ui/button";
import { MISTAKE_PRACTICE_HREF } from "@/lib/links";
import { groupMistakes } from "@/lib/mistake-categories";
import { listMistakes } from "@/lib/mistakes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mistakes · Wafel" };

const toRow = ({ id, original, corrected, explanation, category, resolved }: MistakeRow): MistakeRow => ({
  id,
  original,
  corrected,
  explanation,
  category,
  resolved,
});

export default async function MistakesPage() {
  const mistakes = await listMistakes();
  const groups = groupMistakes(mistakes.map(toRow));
  const open = mistakes.filter((m) => !m.resolved).length;

  const subtitle =
    mistakes.length === 0
      ? "Corrections from your sessions, grouped by type."
      : open === 0
        ? "Everything here is resolved. Nice work."
        : `${open} to work on. Mark one resolved once it feels natural.`;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Mistakes"
        subtitle={subtitle}
        actions={
          open > 0 && (
            <Link
              href={MISTAKE_PRACTICE_HREF}
              className={cn(
                buttonVariants(),
                "h-12 w-full rounded-xl px-6 text-base font-semibold shadow-[0_10px_28px_-14px_var(--honey)] sm:w-auto",
              )}
            >
              Practice
              <ArrowRight data-icon="inline-end" />
            </Link>
          )
        }
      />
      {groups.length === 0 ? (
        <EmptyState icon={PenLine} title="No mistakes yet">
          When your tutor corrects you, the correction lands here so you can come back to it.
        </EmptyState>
      ) : (
        groups.map((group) => <MistakeGroup key={group.category} group={group} />)
      )}
    </div>
  );
}
