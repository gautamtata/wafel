import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { UnitStatus } from "@/generated/prisma/enums";
import { UNIT_STATUS_LABELS } from "@/lib/prompts-meta";
import { cn } from "@/lib/utils";

const STYLES: Record<UnitStatus, string> = {
  NOT_STARTED: "border-border bg-transparent text-muted-foreground",
  IN_PROGRESS: "bg-accent text-foreground",
  MASTERED: "bg-foreground text-background",
};

export function UnitStatusBadge({ status, className }: { status: UnitStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-6 px-2.5 text-[0.6875rem]", STYLES[status], className)}>
      {status === "MASTERED" && <Check data-icon="inline-start" strokeWidth={3} />}
      {UNIT_STATUS_LABELS[status]}
    </Badge>
  );
}
