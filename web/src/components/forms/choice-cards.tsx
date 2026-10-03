"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Choice<T extends string> = {
  value: T;
  title: string;
  description?: string;
  aside?: ReactNode;
  badge?: string;
  disabled?: boolean;
};

type ChoiceCardsProps<T extends string> = {
  name: string;
  label: string;
  value: T | null;
  onChange: (value: T) => void;
  choices: readonly Choice<T>[];
  columns?: 1 | 2;
  compact?: boolean;
};

export function ChoiceCards<T extends string>({
  name,
  label,
  value,
  onChange,
  choices,
  columns = 1,
  compact = false,
}: ChoiceCardsProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-2.5", columns === 2 && "sm:grid-cols-2")}
    >
      {choices.map((choice) => {
        const checked = choice.value === value;
        return (
          <label
            key={choice.value}
            className={cn(
              "group relative flex cursor-pointer items-start gap-4 rounded-2xl border bg-card text-left transition-all has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              compact ? "px-4 py-3" : "p-4 sm:p-5",
              checked
                ? "border-foreground/70 shadow-soft"
                : "hover:border-foreground/25 hover:shadow-soft",
              choice.disabled && "cursor-not-allowed opacity-55 hover:border-border hover:shadow-none",
            )}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={checked}
              disabled={choice.disabled}
              onChange={() => onChange(choice.value)}
              className="sr-only"
            />
            {choice.aside}
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-2 font-medium">
                {choice.title}
                {choice.badge && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                    {choice.badge}
                  </span>
                )}
              </span>
              {choice.description && (
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {choice.description}
                </span>
              )}
            </span>
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                checked ? "border-foreground bg-foreground text-background" : "border-border",
              )}
            >
              {checked && <Check className="size-3" strokeWidth={3} />}
            </span>
          </label>
        );
      })}
    </div>
  );
}
