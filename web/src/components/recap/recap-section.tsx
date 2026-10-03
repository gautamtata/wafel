import type { ReactNode } from "react";

type RecapSectionProps = { id: string; title: string; count?: number; children: ReactNode };

export function RecapSection({ id, title, count, children }: RecapSectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="flex items-baseline gap-2.5 font-display text-2xl font-medium tracking-tight">
        {title}
        {count !== undefined && count > 0 && (
          <span className="font-sans text-sm font-medium text-muted-foreground tabular-nums">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}
