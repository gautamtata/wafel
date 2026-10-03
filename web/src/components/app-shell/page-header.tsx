import type { ReactNode } from "react";

type PageHeaderProps = { title: string; eyebrow?: string; subtitle?: ReactNode; actions?: ReactNode };

export function PageHeader({ title, eyebrow, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[2.75rem] leading-none font-medium tracking-tight text-balance sm:text-6xl">
          {title}
        </h1>
        {subtitle && <p className="mt-3 text-pretty text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}
