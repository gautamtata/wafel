import { Sprout } from "lucide-react";

export function LevelNote({ note }: { note: string }) {
  return (
    <aside className="flex gap-4 rounded-2xl bg-card p-5 shadow-soft ring-1 ring-foreground/5 sm:p-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-foreground/80">
        <Sprout className="size-[1.1rem]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="eyebrow">Level note</p>
        <p className="mt-1.5 text-pretty">{note}</p>
      </div>
    </aside>
  );
}
