"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type TopicOption = { topic: string; covered: boolean };

type TopicPickerProps = {
  topics: TopicOption[];
  suggested: string;
  value: string;
  onChange: (topic: string) => void;
};

export function TopicPicker({ topics, suggested, value, onChange }: TopicPickerProps) {
  const [open, setOpen] = useState(value !== suggested);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">{value === suggested ? "Next topic" : "Topic"} · </span>
          <span className="font-medium">{value}</span>
        </p>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {open ? "Hide topics" : "Choose a different topic"}
        </button>
      </div>
      {open && (
        <ul role="radiogroup" aria-label="Topic" className="flex flex-wrap gap-2">
          {topics.map(({ topic, covered }) => {
            const selected = topic === value;
            return (
              <li key={topic}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(topic)}
                  className={cn(
                    "flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[0.8125rem] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "hover:bg-muted/60",
                    covered && !selected && "text-muted-foreground",
                  )}
                >
                  {covered && <Check className="size-3.5 shrink-0" aria-label="Covered" />}
                  {topic}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
