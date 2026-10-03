import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { generateRecap, RECAP_MODEL, type RecapInput } from "@/lib/recap";
import type { Brief, RecapText, TranscriptEntry } from "@/lib/types";

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

const input: RecapInput = {
  brief,
  transcript,
  mistakes: [{ original: "Yo soy muy bien", corrected: "Estoy muy bien", explanation: "States use estar.", category: "GRAMMAR" }],
  newVocab: [{ word: "gracias", translation: "thank you" }],
};

const canned: RecapText = {
  summary: "You practised greetings. You did well.",
  levelNote: "Solid A1.",
  memory: "The learner practised greetings and confused ser with estar.",
  nextStep: "Drill estar with feelings next time.",
};

const fakeClient = (output_parsed: RecapText | null) => {
  const parse = vi.fn(async () => ({ output_parsed }));
  return { client: { responses: { parse } } as unknown as OpenAI, parse };
};

describe("generateRecap", () => {
  it("asks the Responses API for the text fields only, with the live log in the prompt", async () => {
    const { client, parse } = fakeClient(canned);
    const recap = await generateRecap(input, client);

    expect(recap).toEqual(canned);
    expect(recap).not.toHaveProperty("mistakes");

    const [params] = parse.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(params.model).toBe(RECAP_MODEL);
    expect(params.text).toMatchObject({ format: { type: "json_schema", name: "recap", strict: true } });
    const schema = (params.text as { format: { schema: { properties: Record<string, unknown> } } }).format.schema;
    expect(Object.keys(schema.properties).sort()).toEqual(["levelNote", "memory", "nextStep", "summary"]);
    expect(String(params.instructions)).toMatch(/two sentences/);
    expect(String(params.instructions)).toMatch(/do not invent/);
    expect(String(params.input)).toContain("native language (ISO 639-1 code): en");
    expect(String(params.input)).toContain("[learner] Yo soy muy bien, gracias.");
    expect(String(params.input)).toContain('"corrected":"Estoy muy bien"');
    expect(String(params.input)).toContain('"word":"gracias"');
  });

  it("trims an overlong memory", async () => {
    const memory = Array.from({ length: 70 }, (_, i) => `w${i}`).join(" ");
    const { client } = fakeClient({ ...canned, memory });
    expect((await generateRecap(input, client)).memory.split(" ")).toHaveLength(60);
  });

  it("throws when the model returns no parsed output", async () => {
    const { client } = fakeClient(null);
    await expect(generateRecap(input, client)).rejects.toThrow(/no structured output/);
  });
});
