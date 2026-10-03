import type { Language } from "@/generated/prisma/client";
import { ChoiceCards } from "@/components/forms/choice-cards";

type LanguageStepProps = {
  languages: readonly Language[];
  value: string | null;
  onChange: (code: string) => void;
};

export function LanguageStep({ languages, value, onChange }: LanguageStepProps) {
  return (
    <ChoiceCards
      name="targetLanguage"
      label="Language to learn"
      value={value}
      onChange={onChange}
      choices={languages.map((language) => ({
        value: language.code,
        title: language.name,
        description: language.nativeName,
        disabled: !language.enabled,
        badge: language.enabled ? undefined : "Coming soon",
        aside: (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted font-display text-lg tracking-tight italic">
            {language.code.charAt(0).toUpperCase() + language.code.slice(1)}
          </span>
        ),
      }))}
    />
  );
}
