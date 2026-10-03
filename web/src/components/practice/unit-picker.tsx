"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { UnitStatusBadge } from "@/components/units/unit-status-badge";
import type { UnitSummary } from "@/lib/unit-progress";
import { cn } from "@/lib/utils";

export type UnitOption = Pick<UnitSummary, "id" | "order" | "title" | "canDo" | "status">;

type UnitPickerProps = {
  units: UnitOption[];
  current: string | null;
  value: string | null;
  onChange: (id: string) => void;
};

const linkClass =
  "flex min-h-11 items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

export function UnitPicker({ units, current, value, onChange }: UnitPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = units.find((unit) => unit.id === value);

  if (!selected) {
    return (
      <p className="text-sm text-muted-foreground">
        No units for your Spanish variety yet. Your tutor will pick a topic for your level.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm">
          <span className="text-muted-foreground">{selected.id === current ? "Up next" : `Unit ${selected.order}`} · </span>
          <span className="font-display text-lg font-medium tracking-tight">{selected.title}</span>
        </p>
        <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{selected.canDo}</p>
      </div>
      <div className="flex flex-wrap gap-x-5">
        <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={linkClass}>
          {open ? "Hide units" : "Choose a different unit"}
        </button>
        <Link href="/path" className={linkClass}>
          See your path
        </Link>
      </div>
      {open && (
        <ul role="radiogroup" aria-label="Unit" className="flex flex-col gap-2">
          {units.map((unit) => {
            const checked = unit.id === value;
            return (
              <li key={unit.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => onChange(unit.id)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    checked ? "border-foreground/60 bg-accent/60" : "hover:bg-muted/60",
                  )}
                >
                  <span aria-hidden className="w-5 shrink-0 text-sm text-muted-foreground tabular-nums">
                    {unit.order}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">{unit.title}</span>
                  <UnitStatusBadge status={unit.status} />
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      checked ? "border-foreground bg-foreground text-background" : "border-border",
                    )}
                  >
                    {checked && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
