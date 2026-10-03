import type { CorrectionMode, Pace } from "@/generated/prisma/enums";
import type { Choice } from "@/components/forms/choice-cards";
import { CORRECTION_MODES, type OptionMeta, PACES, VOICES } from "@/lib/prompts-meta";

const fromMeta = <T extends string>(meta: Record<T, OptionMeta>): Choice<T>[] =>
  (Object.entries(meta) as [T, OptionMeta][]).map(([value, { label, description }]) => ({
    value,
    title: label,
    description,
  }));

export const tutorChoices = {
  voices: VOICES.map(({ id, label, description }) => ({ value: id, title: label, description })),
  corrections: fromMeta<CorrectionMode>(CORRECTION_MODES),
  paces: fromMeta<Pace>(PACES),
} satisfies Record<string, Choice<string>[]>;
