import type { UnitPattern } from "@/lib/unit-schema";

export function GrammarNote({ pattern }: { pattern: UnitPattern }) {
  return (
    <div>
      <p className="eyebrow">Grammar note</p>
      <h3 className="mt-1.5 font-display text-lg font-medium tracking-tight">{pattern.name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-pretty text-muted-foreground">{pattern.explanationEn}</p>
      <ul className="mt-3.5 flex flex-col gap-2">
        {pattern.examples.map(({ es, en }) => (
          <li key={es} className="rounded-xl bg-muted/55 px-3.5 py-2.5">
            <p lang="es" className="font-display text-[1.0625rem] leading-snug font-medium tracking-tight">
              {es}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{en}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
