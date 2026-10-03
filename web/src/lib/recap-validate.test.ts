import { describe, expect, it } from "vitest";
import { normalize, validateRecapText } from "@/lib/recap-validate";
import type { RecapText } from "@/lib/types";

const text = (overrides: Partial<RecapText> = {}): RecapText => ({
  summary: "Good session.",
  levelNote: "Solid A1.",
  memory: "Learner is twenty.",
  nextStep: "Practise ser vs estar.",
  ...overrides,
});

describe("normalize", () => {
  it("lowercases, strips punctuation, collapses whitespace and keeps diacritics", () => {
    expect(normalize("  ¡Hola,   SEÑOR!  ¿Qué tal?  ")).toBe("hola señor qué tal");
  });

  it("NFC-normalizes decomposed characters", () => {
    expect(normalize("Qué")).toBe("qué");
  });
});

describe("validateRecapText", () => {
  it("trims memory to 60 words", () => {
    const words = Array.from({ length: 75 }, (_, i) => `word${i}`);
    expect(validateRecapText(text({ memory: words.join(" ") })).memory).toBe(words.slice(0, 60).join(" "));
  });

  it("leaves short memory and other fields untouched", () => {
    const input = text();
    expect(validateRecapText(input)).toEqual(input);
  });
});
