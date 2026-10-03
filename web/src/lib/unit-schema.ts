import { z } from "zod";
import { Cefr } from "@/generated/prisma/enums";

export const UNIT_LIMITS = {
  targetWords: { min: 10, max: 14 },
  modelSentences: 5,
  patternExamples: { min: 2, max: 3 },
} as const;

const line = z.string().trim().min(1);
const bilingual = z.object({ es: line, en: line });

export const unitContentSchema = z.object({
  id: z.string().regex(/^es-MX-(A1|A2|B1|B2|C1|C2)-\d{2}$/, "id must look like es-MX-A1-01"),
  order: z.number().int().min(1),
  title: line,
  canDo: line.startsWith("I can"),
  pattern: z.object({
    name: line,
    explanationEn: line,
    examples: z.array(bilingual).min(UNIT_LIMITS.patternExamples.min).max(UNIT_LIMITS.patternExamples.max),
  }),
  targetWords: z
    .array(z.object({ word: line, translation: line, example: line }))
    .min(UNIT_LIMITS.targetWords.min)
    .max(UNIT_LIMITS.targetWords.max)
    .refine((words) => new Set(words.map((w) => w.word.toLowerCase())).size === words.length, {
      message: "targetWords must be unique",
    }),
  modelSentences: z.array(bilingual).length(UNIT_LIMITS.modelSentences),
  scenarioHint: line.optional(),
});

export const unitFileSchema = z
  .array(unitContentSchema)
  .refine((units) => new Set(units.map((u) => u.id)).size === units.length, { message: "unit ids must be unique" })
  .refine((units) => new Set(units.map((u) => u.order)).size === units.length, { message: "unit orders must be unique" });

export type UnitContent = z.infer<typeof unitContentSchema>;
export type UnitPattern = UnitContent["pattern"];
export type TargetWord = UnitContent["targetWords"][number];
export type ModelSentence = UnitContent["modelSentences"][number];

export const UNIT_LEVELS = Object.values(Cefr);

/** Level encoded in a content file's id; files are named `<LEVEL>.json` and ids embed the level. */
export function unitLevelOf(unit: Pick<UnitContent, "id">): Cefr {
  return unit.id.split("-")[2] as Cefr;
}
