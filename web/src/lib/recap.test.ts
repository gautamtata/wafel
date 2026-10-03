import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { generateRecap, RECAP_MODEL } from "@/lib/recap";
import type { Brief, Recap, TranscriptEntry } from "@/lib/types";

const brief: Brief = {
  sessionId: "s1",
  type: "LESSON",
  language: { code: "es", name: "Spanish", nativeName: "Español" },
  nativeLanguage: "en",
  level: "A1",
  dialect: "MX",
  languagePolicy: "BILINGUAL",
  correctionMode: "SUBTLE",
  pace: "SLOW",
  voice: "marin",
  capMinutes: 20,
  topic: "Greetings and introductions",
  dueVocab: [],
  recentMistakes: [],
  memories: [],
};

const transcript: TranscriptEntry[] = [
  { role: "tutor", text: "¡Hola! ¿Cómo estás?", t: 0 },
  { role: "learner", text: "Yo soy muy bien, gracias.", t: 3 },
  { role: "tutor", text: "Casi: se dice 'estoy muy bien'.", t: 6 },
];

const canned: Recap = {
  summary: "You practised greetings. You did well.",
  mistakes: [
    { original: "Yo soy muy bien", corrected: "Estoy muy bien", explanation: "States use estar.", category: "GRAMMAR" },
    { original: "Me llamo es Ana", corrected: "Me llamo Ana", explanation: "Not in transcript.", category: "GRAMMAR" },
  ],
  newVocab: [{ word: "gracias", translation: "thank you", example: "Gracias por todo." }],
  levelNote: "Solid A1.",
  memory: "The learner practised greetings and confused ser with estar.",
};

const fakeClient = (output_parsed: Recap | null) => {
  const parse = vi.fn(async () => ({ output_parsed }));
  return { client: { responses: { parse } } as unknown as OpenAI, parse };
};

describe("generateRecap", () => {
  it("calls the Responses API with structured output and drops ungrounded mistakes", async () => {
    const { client, parse } = fakeClient(canned);
    const recap = await generateRecap(brief, transcript, client);

    expect(recap.mistakes).toEqual([canned.mistakes[0]]);
    expect(recap.newVocab).toEqual(canned.newVocab);
    expect(recap.summary).toBe(canned.summary);

    const [params] = parse.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(params.model).toBe(RECAP_MODEL);
    expect(params.text).toMatchObject({ format: { type: "json_schema", name: "recap", strict: true } });
    expect(String(params.instructions)).toMatch(/two sentences/);
    expect(String(params.input)).toContain("native language (ISO 639-1 code): en");
    expect(String(params.input)).toContain("[learner] Yo soy muy bien, gracias.");
  });

  it("throws when the model returns no parsed output", async () => {
    const { client } = fakeClient(null);
    await expect(generateRecap(brief, transcript, client)).rejects.toThrow(/no structured output/);
  });
});
