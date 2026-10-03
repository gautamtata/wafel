import type { RecapText } from "@/lib/types";

export const MAX_NEW_VOCAB = 8;
const MAX_MEMORY_WORDS = 60;

const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE = /\s+/g;

export function normalize(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(PUNCTUATION, "").replace(WHITESPACE, " ").trim();
}

function trimWords(text: string, max: number): string {
  const words = text.trim().split(WHITESPACE);
  return words.length > max ? words.slice(0, max).join(" ") : text;
}

export function validateRecapText(raw: RecapText): RecapText {
  return { ...raw, memory: trimWords(raw.memory, MAX_MEMORY_WORDS) };
}
