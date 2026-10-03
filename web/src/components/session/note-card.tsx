"use client";

import { X } from "lucide-react";
import type { Note } from "@/lib/session-live";

type NoteCardProps = { note: Note; onDismiss: (id: string) => void };

export function NoteCard({ note, onDismiss }: NoteCardProps) {
  return (
    <article className="relative rounded-2xl border border-honey/40 bg-card p-4 pr-12 shadow-lift animate-in slide-in-from-bottom-4 fade-in duration-300">
      <p className="eyebrow text-honey">Note</p>
      <h3 className="mt-1 font-display text-lg font-medium tracking-tight">{note.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
        {note.body}
      </p>
      <button
        type="button"
        aria-label="Dismiss note"
        onClick={() => onDismiss(note.id)}
        className="absolute top-2.5 right-2.5 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </article>
  );
}

export function NoteStack({ notes, onDismiss }: { notes: Note[]; onDismiss: (id: string) => void }) {
  if (notes.length === 0) return null;
  return (
    <div aria-label="Tutor notes" className="flex flex-col gap-2">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
