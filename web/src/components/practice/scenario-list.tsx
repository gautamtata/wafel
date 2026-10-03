"use client";

import { Check } from "lucide-react";
import type { ScenarioOption } from "@/lib/scenarios";
import { cn } from "@/lib/utils";

type ScenarioListProps = {
  scenarios: ScenarioOption[];
  value: string | null;
  onChange: (id: string) => void;
};

export function ScenarioList({ scenarios, value, onChange }: ScenarioListProps) {
  if (scenarios.length === 0) {
    return <p className="text-sm text-muted-foreground">No scenarios for your level yet.</p>;
  }
  return (
    <div role="radiogroup" aria-label="Scenario" className="flex flex-col gap-2">
      {scenarios.map((scenario) => {
        const selected = scenario.id === value;
        return (
          <button
            key={scenario.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(scenario.id)}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-foreground/60 bg-accent/60" : "hover:bg-muted/60",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-sm font-medium">
                {scenario.title}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide text-muted-foreground">
                  {scenario.minLevel}
                </span>
              </span>
              <span className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                {scenario.description}
              </span>
            </span>
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-foreground bg-foreground text-background" : "border-border",
              )}
            >
              {selected && <Check className="size-2.5" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
