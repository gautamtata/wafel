import { Field } from "@/components/forms/field";
import { NativeSelect } from "@/components/forms/native-select";
import { Textarea } from "@/components/ui/textarea";
import { GOALS_MAX_LENGTH } from "@/lib/learner-limits";
import { NATIVE_LANGUAGES } from "@/lib/native-languages";

type NativeStepProps = {
  nativeLanguage: string;
  goals: string;
  onNativeLanguageChange: (code: string) => void;
  onGoalsChange: (goals: string) => void;
};

export function NativeStep({
  nativeLanguage,
  goals,
  onNativeLanguageChange,
  onGoalsChange,
}: NativeStepProps) {
  return (
    <div className="flex flex-col gap-8">
      <Field label="Your language" htmlFor="nativeLanguage">
        <NativeSelect
          id="nativeLanguage"
          value={nativeLanguage}
          onChange={(event) => onNativeLanguageChange(event.target.value)}
        >
          {NATIVE_LANGUAGES.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        label="What's it for? (optional)"
        hint="Your tutor will steer conversations toward it."
        htmlFor="goals"
      >
        <Textarea
          id="goals"
          value={goals}
          maxLength={GOALS_MAX_LENGTH}
          onChange={(event) => onGoalsChange(event.target.value)}
          placeholder="Talking with my partner's family, a month in Oaxaca, work calls…"
          className="min-h-28 rounded-xl bg-card px-4 py-3 text-base md:text-base"
        />
      </Field>
    </div>
  );
}
