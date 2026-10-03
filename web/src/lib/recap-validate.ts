import type { Recap, TranscriptEntry } from "@/lib/types";

export const MAX_NEW_VOCAB = 8;
const MAX_MEMORY_WORDS = 60;

const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE = /\s+/g;

export function normalize(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(PUNCTUATION, "").replace(WHITESPACE, " ").trim();
}

const padded = (s: string) => ` ${s} `;

function trimWords(text: string, max: number): string {
  const words = text.trim().split(WHITESPACE);
  return words.length > max ? words.slice(0, max).join(" ") : text;
}

export function validateRecap(raw: Recap, transcript: TranscriptEntry[]): Recap {
  const learnerLines = transcript
    .filter((entry) => entry.role === "learner")
    .map((entry) => padded(normalize(entry.text)));

  const isGrounded = (original: string) => {
    const needle = normalize(original);
    return needle !== "" && learnerLines.some((line) => line.includes(padded(needle)));
  };

  return {
    ...raw,
    mistakes: raw.mistakes.filter((m) => isGrounded(m.original)),
    newVocab: raw.newVocab.slice(0, MAX_NEW_VOCAB),
    memory: trimWords(raw.memory, MAX_MEMORY_WORDS),
  };
}
