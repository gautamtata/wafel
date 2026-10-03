"use client";

import { useEffect, useRef, useState } from "react";
import type { Turn } from "@/lib/session-live";
import { cn } from "@/lib/utils";

export const VISIBLE_TURNS = 6;

function TurnBubble({ turn }: { turn: Turn }) {
  const learner = turn.role === "learner";
  return (
    <li
      data-role={turn.role}
      className={cn("flex", learner ? "justify-end pl-10" : "justify-start pr-6")}
    >
      <p
        className={cn(
          "max-w-[34rem] text-pretty leading-relaxed transition-opacity",
          learner
            ? "rounded-2xl rounded-br-md bg-muted/70 px-4 py-2.5 text-right text-[0.9375rem] text-muted-foreground"
            : "font-display text-[1.1875rem] font-medium tracking-tight text-foreground",
          !turn.final && "opacity-60",
        )}
      >
        {turn.text}
      </p>
    </li>
  );
}

export function TranscriptFeed({ turns, className }: { turns: Turn[]; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hidden = Math.max(0, turns.length - VISIBLE_TURNS);
  const visible = expanded ? turns : turns.slice(hidden);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  if (turns.length === 0) {
    return (
      <p className={cn("text-center text-sm text-muted-foreground", className)}>
        Your tutor is on the way. Say hola when you hear them.
      </p>
    );
  }

  return (
    <div ref={scrollRef} className={cn("flex flex-col gap-3 overflow-y-auto overscroll-contain", className)}>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="self-center rounded-full px-3 py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {expanded ? "Show recent" : `Show all (${turns.length})`}
        </button>
      )}
      <ol aria-label="Transcript" aria-live="polite" className="flex flex-col gap-3">
        {visible.map((turn) => (
          <TurnBubble key={turn.id} turn={turn} />
        ))}
      </ol>
    </div>
  );
}
