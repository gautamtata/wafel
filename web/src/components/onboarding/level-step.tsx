import type { Cefr } from "@/generated/prisma/enums";
import { ChoiceCards } from "@/components/forms/choice-cards";
import { LEVEL_DESCRIPTORS } from "@/lib/prompts-meta";

type LevelStepProps = { value: Cefr | null; onChange: (level: Cefr) => void };

const LEVELS = Object.entries(LEVEL_DESCRIPTORS) as [Cefr, (typeof LEVEL_DESCRIPTORS)[Cefr]][];

export function LevelStep({ value, onChange }: LevelStepProps) {
  return (
    <ChoiceCards
      name="level"
      label="Your level"
      value={value}
      onChange={onChange}
      choices={LEVELS.map(([level, { title, description }]) => ({
        value: level,
        title,
        description,
        aside: (
          <span className="w-9 shrink-0 font-display text-2xl leading-none font-medium tracking-tight">
            {level}
          </span>
        ),
      }))}
    />
  );
}
