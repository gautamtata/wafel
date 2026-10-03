"use client";

import { useState } from "react";
import { toast } from "sonner";
import { QuietSwitch } from "@/components/forms/quiet-switch";
import { SAVE_FAILED, send } from "@/lib/client-fetch";
import type { Recap } from "@/lib/types";

export type PickWord = Recap["newVocab"][number] & { id: string | null };

function VocabPick({ word, sessionId }: { word: PickWord; sessionId: string }) {
  const [id, setId] = useState(word.id);
  const [inDeck, setInDeck] = useState(word.id !== null);
  const [pending, setPending] = useState(false);

  async function toggle(next: boolean) {
    setInDeck(next);
    setPending(true);
    try {
      if (next) {
        const { word: text, translation, example } = word;
        const res = await send("/api/vocab", "POST", { word: text, translation, example, sourceSessionId: sessionId });
        setId(((await res.json()) as { id: string }).id);
      } else if (id) {
        await send(`/api/vocab/${id}`, "DELETE");
        setId(null);
      }
    } catch {
      setInDeck(!next);
      toast.error(SAVE_FAILED);
    }
    setPending(false);
  }

  return (
    <li className="flex items-center gap-4 px-5 py-4 sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-lg font-medium tracking-tight">
            {word.word}
          </span>
          <span className="text-muted-foreground">{word.translation}</span>
        </p>
        {word.example && (
          <p className="mt-1 text-sm text-pretty text-muted-foreground italic">
            {word.example}
          </p>
        )}
      </div>
      <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5 text-sm font-medium text-muted-foreground">
        In deck
        <QuietSwitch checked={inDeck} disabled={pending} onCheckedChange={toggle} />
      </label>
    </li>
  );
}

export function VocabPicks({ words, sessionId }: { words: PickWord[]; sessionId: string }) {
  if (words.length === 0) {
    return <p className="text-muted-foreground">No new words this time.</p>;
  }
  return (
    <ul className="divide-y overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-foreground/5">
      {words.map((word) => (
        <VocabPick key={word.word} word={word} sessionId={sessionId} />
      ))}
    </ul>
  );
}
