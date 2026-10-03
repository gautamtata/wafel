import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { MistakeCategory } from "@/generated/prisma/enums";
import { validateRecap } from "@/lib/recap-validate";
import type { Brief, Recap, TranscriptEntry } from "@/lib/types";

export const RECAP_MODEL = "gpt-5.4-mini";

const categories = Object.values(MistakeCategory) as [MistakeCategory, ...MistakeCategory[]];

export const recapSchema = z.object({
  summary: z.string(),
  mistakes: z.array(
    z.object({
      original: z.string(),
      corrected: z.string(),
      explanation: z.string(),
      category: z.enum(categories),
    }),
  ),
  newVocab: z.array(z.object({ word: z.string(), translation: z.string(), example: z.string() })),
  levelNote: z.string(),
  memory: z.string(),
});

const INSTRUCTIONS = `You are the post-lesson reviewer for a one-to-one spoken language lesson.
You receive the lesson brief and the full transcript (tutor and learner turns, in order).
Produce a recap as JSON:
- summary: exactly two sentences about what the learner practised and how it went.
- mistakes: real errors the learner made in the target language. "original" must be copied verbatim from a learner line (a contiguous fragment, same spelling); "corrected" is the fixed form; "explanation" is one short sentence; "category" is one of the given values. Skip tutor lines, hesitations and disfluencies.
- newVocab: up to 8 target-language words or short phrases the learner met or needed. "word" is in the target language; "translation" is its meaning written in the learner's native language (never a copy of the word); "example" is a short sentence in the target language.
- levelNote: one line on how the learner's performance compares with their CEFR level.
- memory: at most 60 words, third person, facts worth remembering for the next lesson (interests, struggles, what was covered).
Write "explanation", "levelNote" and "memory" in English.`;

function prompt(brief: Brief, transcript: TranscriptEntry[]): string {
  const lines = transcript.map((entry) => `[${entry.role}] ${entry.text}`).join("\n");
  const context = { ...brief, sessionId: undefined };
  return [
    `Target language: ${brief.language.name} (${brief.language.code}).`,
    `Learner's native language (ISO 639-1 code): ${brief.nativeLanguage}. Write "summary" and every "translation" in that language.`,
    `Learner level: ${brief.level}.`,
    "",
    "Lesson brief:",
    JSON.stringify(context),
    "",
    "Transcript:",
    lines,
  ].join("\n");
}

let defaultClient: OpenAI | undefined;
const client = () => (defaultClient ??= new OpenAI());

export async function generateRecap(
  brief: Brief,
  transcript: TranscriptEntry[],
  openai: OpenAI = client(),
): Promise<Recap> {
  const response = await openai.responses.parse({
    model: RECAP_MODEL,
    instructions: INSTRUCTIONS,
    input: prompt(brief, transcript),
    text: { format: zodTextFormat(recapSchema, "recap") },
  });
  const parsed = response.output_parsed;
  if (!parsed) throw new Error("Recap model returned no structured output");
  return validateRecap(parsed, transcript);
}
