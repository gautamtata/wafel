import { X } from "lucide-react";
import type { Phrase } from "@/lib/session-live";

type PhraseCardProps = { phrase: Phrase | null; onDismiss: () => void };

export function PhraseCard({ phrase, onDismiss }: PhraseCardProps) {
  return (
    <div aria-live="polite" className="w-full">
      {phrase && (
        <figure
          key={phrase.id}
          className="relative w-full overflow-hidden rounded-2xl bg-card px-12 pt-4 pb-4.5 text-center shadow-lift ring-1 ring-foreground/5 duration-500 animate-in fade-in zoom-in-[0.97] slide-in-from-bottom-2 motion-reduce:animate-none"
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
          <button
            type="button"
            aria-label="Dismiss phrase"
            onClick={onDismiss}
            className="absolute top-1.5 right-1.5 flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </figure>
      )}
    </div>
  );
}
