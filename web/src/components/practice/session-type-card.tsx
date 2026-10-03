"use client";

import { Check, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { SESSION_TYPE_ICONS } from "@/components/session-type-icons";
import type { SessionType } from "@/generated/prisma/enums";
import { SESSION_TYPE_LABELS } from "@/lib/session-labels";
import { cn } from "@/lib/utils";

type SessionTypeCardProps = {
  type: SessionType;
  description: string;
  selected: boolean;
  disabledHint?: string;
  onSelect: (type: SessionType) => void;
  children?: ReactNode;
};

export function SessionTypeCard({
  type,
  description,
  selected,
  disabledHint,
  onSelect,
  children,
}: SessionTypeCardProps) {
  const Icon = SESSION_TYPE_ICONS[type];
  const disabled = disabledHint !== undefined;
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card transition-all",
        selected ? "border-foreground/70 shadow-soft" : "hover:border-foreground/25 hover:shadow-soft",
        disabled && "opacity-60 hover:border-border hover:shadow-none",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={() => onSelect(type)}
        className="flex w-full items-start gap-4 p-4 text-left outline-none focus-visible:rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed sm:p-5"
      >
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
            selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/75",
          )}
        >
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-medium">{SESSION_TYPE_LABELS[type]}</span>
          <span className="text-sm leading-relaxed text-muted-foreground">
            {disabledHint ?? description}
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected ? "border-foreground bg-foreground text-background" : "border-border",
          )}
        >
          {selected && <Check className="size-3" strokeWidth={3} />}
          {disabled && <Lock className="size-2.5 text-muted-foreground" />}
        </span>
      </button>
      {selected && children && <div className="border-t px-4 pt-4 pb-4 sm:px-5">{children}</div>}
    </div>
  );
}
