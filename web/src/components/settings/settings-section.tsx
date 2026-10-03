import type { ReactNode } from "react";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="eyebrow px-1">{title}</h2>
      <div className="flex flex-col gap-7 rounded-2xl bg-card p-5 shadow-soft ring-1 ring-foreground/5 sm:p-6">
        {children}
      </div>
    </section>
  );
}
