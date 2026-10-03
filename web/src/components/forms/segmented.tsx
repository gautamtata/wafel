"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string; icon?: LucideIcon };

type SegmentedProps<T extends string> = {
  name: string;
  label: string;
  value: T | null;
  onChange: (value: T) => void;
  options: readonly Option<T>[];
};

export function Segmented<T extends string>({
  name,
  label,
  value,
  onChange,
  options,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1"
    >
      {options.map(({ value: option, label: optionLabel, icon: Icon }) => (
        <label
          key={option}
          className={cn(
            "flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground transition-all has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            option === value && "bg-card text-foreground shadow-soft",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={option === value}
            onChange={() => onChange(option)}
            className="sr-only"
          />
          {Icon && <Icon className="size-4" />}
          {optionLabel}
        </label>
      ))}
    </div>
  );
}
