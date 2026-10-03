import type { Phrase } from "@/lib/session-live";

export function PhraseCard({ phrase }: { phrase: Phrase | null }) {
  if (!phrase) return null;
  return (
    <figure
      key={phrase.id}
      aria-live="polite"
      className="relative w-full overflow-hidden rounded-2xl bg-card px-5 pt-4 pb-4.5 text-center shadow-lift ring-1 ring-foreground/5 duration-500 animate-in fade-in zoom-in-[0.97] slide-in-from-bottom-2"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-honey" />
      <p className="eyebrow">Say it</p>
      <p
        lang="es"
        className="mt-2 font-display text-[1.625rem] leading-[1.15] font-medium tracking-tight text-balance sm:text-3xl"
      >
        {phrase.spanish}
      </p>
      <figcaption className="mt-1.5 text-[0.9375rem] text-pretty text-muted-foreground">{phrase.english}</figcaption>
    </figure>
  );
}
