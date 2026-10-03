import { describe, expect, it } from "vitest";
import { normalize, validateRecap } from "@/lib/recap-validate";
import type { Recap, RecapMistake, TranscriptEntry } from "@/lib/types";

const transcript: TranscriptEntry[] = [
  { role: "tutor", text: "¿Cuántos años tienes?", t: 3 },
  { role: "learner", text: "Yo tengo veinte año.", t: 6.5 },
  { role: "tutor", text: "¡Ah, tienes veinte años! Nunca dije esto.", t: 9 },
];

const mistake = (original: string): RecapMistake => ({
  original,
  corrected: "Tengo veinte años",
  explanation: "Años is plural.",
  category: "AGREEMENT",
});

const recap = (overrides: Partial<Recap> = {}): Recap => ({
  summary: "Good session.",
  mistakes: [],
  newVocab: [],
  levelNote: "Solid A1.",
  memory: "Learner is twenty.",
  ...overrides,
});

describe("normalize", () => {
  it("lowercases, strips punctuation, collapses whitespace and keeps diacritics", () => {
    expect(normalize("  ¡Hola,   SEÑOR!  ¿Qué tal?  ")).toBe("hola señor qué tal");
  });

  it("NFC-normalizes decomposed characters", () => {
    expect(normalize("Qué")).toBe("qué");
  });
});

describe("validateRecap", () => {
  it("keeps mistakes grounded in a learner line", () => {
    const result = validateRecap(recap({ mistakes: [mistake("yo tengo veinte año")] }), transcript);
    expect(result.mistakes).toHaveLength(1);
  });

  it("drops mistakes not found in learner lines, including tutor-only text", () => {
    const result = validateRecap(
      recap({ mistakes: [mistake("nunca dije esto"), mistake("¿Cuántos años tienes?"), mistake("  ")] }),
      transcript,
    );
    expect(result.mistakes).toEqual([]);
  });

  it("matches whole words only", () => {
    const result = validateRecap(recap({ mistakes: [mistake("tengo veinte añ")] }), transcript);
    expect(result.mistakes).toEqual([]);
  });

  it("caps new vocab at 8", () => {
    const newVocab = Array.from({ length: 11 }, (_, i) => ({ word: `w${i}`, translation: `t${i}`, example: "" }));
    expect(validateRecap(recap({ newVocab }), transcript).newVocab).toEqual(newVocab.slice(0, 8));
  });

  it("trims memory to 60 words", () => {
    const words = Array.from({ length: 75 }, (_, i) => `word${i}`);
    const result = validateRecap(recap({ memory: words.join(" ") }), transcript);
    expect(result.memory).toBe(words.slice(0, 60).join(" "));
  });

  it("leaves short memory and other fields untouched", () => {
    const input = recap();
    expect(validateRecap(input, transcript)).toEqual(input);
  });
});
