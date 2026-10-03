import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MistakeCategory } from "@/generated/prisma/enums";
import { MISTAKE_CATEGORY_LABELS } from "@/lib/mistake-categories";
import { cn } from "@/lib/utils";

type CorrectionProps = { original: string; corrected: string; className?: string };

export function Correction({ original, corrected, className }: CorrectionProps) {
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[1.0625rem] leading-snug", className)}>
      <del className="text-muted-foreground line-through decoration-muted-foreground/50">{original}</del>
      <ArrowRight aria-hidden className="size-3.5 shrink-0 self-center text-muted-foreground/60" />
      <span className="sr-only">corrected to</span>
      <ins className="font-medium text-foreground no-underline">{corrected}</ins>
    </p>
  );
}

export function CategoryBadge({ category }: { category: MistakeCategory }) {
  return (
    <Badge variant="secondary" className="h-6 px-2.5 text-[0.6875rem] text-muted-foreground">
      {MISTAKE_CATEGORY_LABELS[category]}
    </Badge>
  );
}
