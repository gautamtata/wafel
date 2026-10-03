"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Language } from "@/generated/prisma/client";
import type { Cefr } from "@/generated/prisma/enums";
import { VOICES } from "@/lib/prompts-meta";
import { LanguageStep } from "./language-step";
import { LevelStep } from "./level-step";
import { NativeStep } from "./native-step";
import { type StepMeta, Stepper } from "./stepper";
import { type TutorStyle, VoiceStep } from "./voice-step";

type Draft = TutorStyle & {
  targetLanguage: string | null;
  nativeLanguage: string;
  goals: string;
  level: Cefr | null;
};

const STEPS: readonly StepMeta[] = [
  {
    title: "What would you like to speak?",
    subtitle: "Wafel teaches one language at a time, out loud, with a tutor who listens.",
  },
  {
    title: "And what do you already speak?",
    subtitle: "Recaps and explanations will be written in this language.",
  },
  {
    title: "Where are you starting from?",
    subtitle: "Pick the one that sounds most like you. You can change it any time.",
  },
  {
    title: "How should your tutor sound?",
    subtitle: "There are no wrong answers here. Everything can be changed in settings.",
  },
];

export function OnboardingFlow({ languages }: { languages: readonly Language[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => ({
    targetLanguage: languages.find((l) => l.enabled)?.code ?? null,
    nativeLanguage: "en",
    goals: "",
    level: null,
    voice: VOICES[0].id,
    correctionMode: "SUBTLE",
    pace: "SLOW",
  }));

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const canAdvance = [draft.targetLanguage !== null, true, draft.level !== null, true][step];

  async function finish() {
    setPending(true);
    try {
      const res = await fetch("/api/learner", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, onboardedAt: new Date().toISOString() }),
      });
      if (res.ok) {
        router.replace("/");
        return;
      }
      toast.error("Couldn't save your answers. Try again.");
    } catch {
      toast.error("Can't reach Wafel. Check your connection.");
    }
    setPending(false);
  }

  const onNext = () => (step === STEPS.length - 1 ? finish() : setStep(step + 1));

  return (
    <Stepper
      steps={STEPS}
      current={step}
      canAdvance={canAdvance}
      pending={pending}
      finishLabel="Start learning"
      onBack={() => setStep(step - 1)}
      onNext={onNext}
    >
      {step === 0 && (
        <LanguageStep
          languages={languages}
          value={draft.targetLanguage}
          onChange={(targetLanguage) => update({ targetLanguage })}
        />
      )}
      {step === 1 && (
        <NativeStep
          nativeLanguage={draft.nativeLanguage}
          goals={draft.goals}
          onNativeLanguageChange={(nativeLanguage) => update({ nativeLanguage })}
          onGoalsChange={(goals) => update({ goals })}
        />
      )}
      {step === 2 && <LevelStep value={draft.level} onChange={(level) => update({ level })} />}
      {step === 3 && <VoiceStep {...draft} onChange={update} />}
    </Stepper>
  );
}
