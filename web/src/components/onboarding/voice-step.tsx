import type { CorrectionMode, Pace } from "@/generated/prisma/enums";
import { ChoiceCards } from "@/components/forms/choice-cards";
import { Field } from "@/components/forms/field";
import { tutorChoices } from "@/components/forms/tutor-choices";

export type TutorStyle = { voice: string; correctionMode: CorrectionMode; pace: Pace };

type VoiceStepProps = TutorStyle & { onChange: (patch: Partial<TutorStyle>) => void };

export function VoiceStep({ voice, correctionMode, pace, onChange }: VoiceStepProps) {
  return (
    <div className="flex flex-col gap-10">
      <Field label="Voice">
        <ChoiceCards
          name="voice"
          label="Voice"
          value={voice}
          onChange={(value) => onChange({ voice: value })}
          choices={tutorChoices.voices}
          columns={2}
          compact
        />
      </Field>
      <Field label="Corrections">
        <ChoiceCards
          name="correctionMode"
          label="Corrections"
          value={correctionMode}
          onChange={(value) => onChange({ correctionMode: value })}
          choices={tutorChoices.corrections}
        />
      </Field>
      <Field label="Pace">
        <ChoiceCards
          name="pace"
          label="Pace"
          value={pace}
          onChange={(value) => onChange({ pace: value })}
          choices={tutorChoices.paces}
          columns={2}
          compact
        />
      </Field>
    </div>
  );
}
