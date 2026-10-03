import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { validateRecapText } from "@/lib/recap-validate";
import type { Brief, RecapMistake, RecapText, TranscriptEntry, VocabEntry } from "@/lib/types";

export const RECAP_MODEL = "gpt-5.4-mini";

export const recapTextSchema = z.object({
  summary: z.string(),
  levelNote: z.string(),
  memory: z.string(),
  nextStep: z.string(),
}) satisfies z.ZodType<RecapText>;

export type RecapInput = {
  brief: Brief;
  transcript: TranscriptEntry[];
  mistakes: RecapMistake[];
  newVocab: VocabEntry[];
};

const INSTRUCTIONS = `You are the post-lesson reviewer for a one-to-one spoken language lesson.
You receive the lesson brief, the full transcript (tutor and learner turns, in order), and the live log: the mistakes the tutor corrected and the new words it taught during the lesson. The live log is authoritative; do not invent further corrections from the transcript.
Produce a recap as JSON:
- summary: exactly two sentences about what the learner practised and how it went.
- levelNote: one line on how the learner's performance compares with their CEFR level.
- memory: at most 60 words, third person, facts worth remembering for the next lesson (interests, struggles, what was covered).
- nextStep: one sentence telling the learner what to focus on next time, based on the unit, the logged mistakes and the weak words.
Write "levelNote", "memory" and "nextStep" in English.`;

function prompt({ brief, transcript, mistakes, newVocab }: RecapInput): string {
  const lines = transcript.map((entry) => `[${entry.role}] ${entry.text}`).join("\n");
  const context = { ...brief, sessionId: undefined };
  return [
    `Target language: ${brief.language.name} (${brief.language.code}).`,
    `Learner's native language (ISO 639-1 code): ${brief.nativeLanguage}. Write "summary" in that language.`,
    `Learner level: ${brief.level}.`,
    "",
    "Lesson brief:",
    JSON.stringify(context),
    "",
    "Live log:",
    JSON.stringify({ mistakes, newVocab }),
    "",
    "Transcript:",
    lines,
  ].join("\n");
}

let defaultClient: OpenAI | undefined;
const client = () => (defaultClient ??= new OpenAI());

export async function generateRecap(input: RecapInput, openai: OpenAI = client()): Promise<RecapText> {
  const response = await openai.responses.parse({
    model: RECAP_MODEL,
    instructions: INSTRUCTIONS,
    input: prompt(input),
    text: { format: zodTextFormat(recapTextSchema, "recap") },
  });
  const parsed = response.output_parsed;
  if (!parsed) throw new Error("Recap model returned no structured output");
  return validateRecapText(parsed);
}
