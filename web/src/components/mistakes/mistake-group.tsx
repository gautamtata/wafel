"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { Mistake } from "@/generated/prisma/client";
import { SAVE_FAILED, send } from "@/lib/client-fetch";
import type { MistakeGroupOf } from "@/lib/mistake-categories";
import { cn } from "@/lib/utils";
import { Correction } from "./correction";

export type MistakeRow = Pick<Mistake, "id" | "original" | "corrected" | "explanation" | "category" | "resolved">;

export function MistakeGroup({ group }: { group: MistakeGroupOf<MistakeRow> }) {
  const router = useRouter();
  const [rows, setRows] = useState(group.mistakes);
  const open = rows.filter((row) => !row.resolved).length;
  const headingId = `group-${group.category.toLowerCase()}`;

  const setResolved = (id: string, resolved: boolean) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, resolved } : row)));

  async function toggle(id: string, resolved: boolean) {
    setResolved(id, resolved);
    try {
      await send(`/api/mistakes/${id}`, "PATCH", { resolved });
      router.refresh();
    } catch {
      setResolved(id, !resolved);
      toast.error(SAVE_FAILED);
    }
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id={headingId} className="font-display text-2xl font-medium tracking-tight">
          {group.label}
        </h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {open === 0 ? "All resolved" : `${open} open`}
        </span>
      </div>
      <ul className="divide-y overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-foreground/5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-4 px-5 py-4 sm:px-6">
            <div className={cn("min-w-0 flex-1 transition-opacity", row.resolved && "opacity-55")}>
              <Correction original={row.original} corrected={row.corrected} />
              {row.explanation && (
                <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{row.explanation}</p>
              )}
            </div>
            <label className="-my-1 flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5 text-sm font-medium text-muted-foreground">
              Resolved
              <Switch checked={row.resolved} onCheckedChange={(checked) => toggle(row.id, checked)} />
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
