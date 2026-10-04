import type { TextStreamData } from "@livekit/components-react";
import { describe, expect, it } from "vitest";
import { knownLinesOf, matchKnownLine, parsePhrase, sameLine, toTurns } from "./session-live";

const stream = (
  id: string,
  identity: string,
  text: string,
  attributes: Record<string, string> = {},
  timestamp = 0,
): TextStreamData => ({
  text,
  participantInfo: { identity },
  streamInfo: { id, topic: "lk.transcription", mimeType: "text/plain", timestamp, attributes, encryptionType: 0 },
});

describe("toTurns", () => {
  it("keeps arrival order and merges streams of the same segment", () => {
    const turns = toTurns([
      stream("a", "agent-x", "Hola", { "lk.segment_id": "seg1" }, 50),
      stream("b", "learner", "Hola, bien", {}, 10),
      stream("c", "agent-x", "Hola, ¿qué tal?", { "lk.segment_id": "seg1", "lk.transcription_final": "true" }, 60),
      stream("d", "agent-x", "   ", { "lk.segment_id": "seg2" }),
    ]);
    expect(turns).toEqual([
      { id: "seg1", role: "tutor", text: "Hola, ¿qué tal?", at: 60, final: true },
      { id: "b", role: "learner", text: "Hola, bien", at: 10, final: false },
    ]);
  });
});

describe("parsePhrase", () => {
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

  it("parses a wafel.phrase data message", () => {
    expect(parsePhrase(encode({ type: "phrase", spanish: "¿Me da dos tacos?", english: "Can I have two tacos?" }))).toEqual({
      spanish: "¿Me da dos tacos?",
      english: "Can I have two tacos?",
    });
  });

  it("trims and rejects malformed or empty payloads", () => {
    expect(parsePhrase(encode({ type: "phrase", spanish: "  Hola ", english: " Hi " }))).toEqual({ spanish: "Hola", english: "Hi" });
    expect(parsePhrase(encode({ type: "note", spanish: "Hola", english: "Hi" }))).toBeNull();
    expect(parsePhrase(encode({ type: "phrase", spanish: "Hola" }))).toBeNull();
    expect(parsePhrase(encode({ type: "phrase", spanish: "   ", english: "Hi" }))).toBeNull();
    expect(parsePhrase(new TextEncoder().encode("{oops"))).toBeNull();
  });
});

describe("known lines", () => {
  const unit = {
    modelSentences: [{ es: "Ayer fui al mercado.", en: "Yesterday I went to the market." }],
    pattern: { name: "pretérito", explanationEn: "x", examples: [{ es: "Comí tacos.", en: "I ate tacos." }] },
    targetWords: [{ word: "el mercado", translation: "the market", example: "Voy al mercado los sábados." }],
  };

  it("collects model sentences, pattern examples and target-word examples with their English", () => {
    expect(knownLinesOf(unit)).toEqual([
      { spanish: "Ayer fui al mercado.", english: "Yesterday I went to the market." },
      { spanish: "Comí tacos.", english: "I ate tacos." },
      { spanish: "Voy al mercado los sábados.", english: "el mercado — the market" },
    ]);
    expect(knownLinesOf(undefined)).toEqual([]);
  });

  it("matches a contained line ignoring case and punctuation", () => {
    const lines = knownLinesOf(unit);
    expect(matchKnownLine("Repite: AYER FUI AL MERCADO", lines)?.english).toBe("Yesterday I went to the market.");
    expect(matchKnownLine("Hoy comí tortas con mi hermana", lines)).toBeNull();
    expect(matchKnownLine("Muy bien, comí tacos ayer", lines)?.spanish).toBe("Comí tacos.");
    expect(matchKnownLine("", lines)).toBeNull();
    expect(sameLine("Ayer fui al mercado", "¡Ayer fui al mercado!")).toBe(true);
  });
});
