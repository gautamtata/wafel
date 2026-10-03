"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ThemeChoice } from "@/components/app-shell/theme-toggle";
import { Field } from "@/components/forms/field";
import { NativeSelect } from "@/components/forms/native-select";
import { Segmented } from "@/components/forms/segmented";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Cefr, CorrectionMode, Dialect, Pace } from "@/generated/prisma/enums";
import { GOALS_MAX_LENGTH } from "@/lib/learner-limits";
import { NATIVE_LANGUAGES } from "@/lib/native-languages";
import { CORRECTION_MODES, DIALECTS, LEVEL_DESCRIPTORS, PACES, VOICES } from "@/lib/prompts-meta";
import { LogoutButton } from "./logout-button";
import { SettingsSection } from "./settings-section";

export type LearnerSettings = {
  level: Cefr;
  dialect: Dialect;
  correctionMode: CorrectionMode;
  pace: Pace;
  voice: string;
  sessionCapMinutes: number;
  nativeLanguage: string;
  goals: string;
};

const CAP_OPTIONS = [10, 15, 20, 30, 45, 60];

const entries = <K extends string, V>(record: Record<K, V>) => Object.entries(record) as [K, V][];

const toOptions = <K extends string>(record: Record<K, { label: string }>) =>
  entries(record).map(([value, { label }]) => ({ value, label }));

const CORRECTION_OPTIONS = toOptions(CORRECTION_MODES);
const PACE_OPTIONS = toOptions(PACES);
const DIALECT_OPTIONS = toOptions(DIALECTS);

export function SettingsForm({ initial }: { initial: LearnerSettings }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);

  const set = <K extends keyof LearnerSettings>(key: K, value: LearnerSettings[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const dirty = (Object.keys(values) as (keyof LearnerSettings)[]).some(
    (key) => values[key] !== saved[key],
  );
  const capOptions = CAP_OPTIONS.includes(values.sessionCapMinutes)
    ? CAP_OPTIONS
    : [...CAP_OPTIONS, values.sessionCapMinutes].sort((a, b) => a - b);
  const voice = VOICES.find((v) => v.id === values.voice);

  async function save() {
    setPending(true);
    try {
      const res = await fetch("/api/learner", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        setSaved(values);
        toast.success("Saved");
        router.refresh();
      } else {
        toast.error("Couldn't save. Try again.");
      }
    } catch {
      toast.error("Can't reach Wafel. Check your connection.");
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection title="Learning">
        <Field label="Level" hint={LEVEL_DESCRIPTORS[values.level].description} htmlFor="level">
          <NativeSelect
            id="level"
            value={values.level}
            onChange={(event) => set("level", event.target.value as Cefr)}
          >
            {entries(LEVEL_DESCRIPTORS).map(([level, { title }]) => (
              <option key={level} value={level}>
                {level} · {title}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Spanish variety" hint={DIALECTS[values.dialect].description} htmlFor="dialect">
          <NativeSelect
            id="dialect"
            value={values.dialect}
            onChange={(event) => set("dialect", event.target.value as Dialect)}
          >
            {DIALECT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Corrections" hint={CORRECTION_MODES[values.correctionMode].description}>
          <Segmented
            name="correctionMode"
            label="Corrections"
            value={values.correctionMode}
            onChange={(value) => set("correctionMode", value)}
            options={CORRECTION_OPTIONS}
          />
        </Field>
        <Field label="Pace" hint={PACES[values.pace].description}>
          <Segmented
            name="pace"
            label="Pace"
            value={values.pace}
            onChange={(value) => set("pace", value)}
            options={PACE_OPTIONS}
          />
        </Field>
      </SettingsSection>

      <SettingsSection title="Tutor">
        <Field label="Voice" hint={voice?.description} htmlFor="voice">
          <NativeSelect
            id="voice"
            value={values.voice}
            onChange={(event) => set("voice", event.target.value)}
          >
            {VOICES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Session length"
          hint="Your tutor wraps up when time is up."
          htmlFor="sessionCapMinutes"
        >
          <NativeSelect
            id="sessionCapMinutes"
            value={values.sessionCapMinutes}
            onChange={(event) => set("sessionCapMinutes", Number(event.target.value))}
          >
            {capOptions.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </NativeSelect>
        </Field>
      </SettingsSection>

      <SettingsSection title="About you">
        <Field label="Your language" hint="Recaps are written in it." htmlFor="nativeLanguage">
          <NativeSelect
            id="nativeLanguage"
            value={values.nativeLanguage}
            onChange={(event) => set("nativeLanguage", event.target.value)}
          >
            {NATIVE_LANGUAGES.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Goals" hint="Your tutor steers conversations toward them." htmlFor="goals">
          <Textarea
            id="goals"
            value={values.goals}
            maxLength={GOALS_MAX_LENGTH}
            onChange={(event) => set("goals", event.target.value)}
            placeholder="e.g. talk with my Mexican friends in California"
            className="min-h-24 rounded-xl px-4 py-3 text-base md:text-base"
          />
        </Field>
      </SettingsSection>

      <SettingsSection title="Appearance">
        <ThemeChoice />
      </SettingsSection>

      <SettingsSection title="Account">
        <LogoutButton />
      </SettingsSection>

      {dirty && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] duration-300 animate-in fade-in slide-in-from-bottom-3 md:bottom-6">
          <Button
            onClick={save}
            disabled={pending}
            className="h-12 w-full rounded-xl text-base font-semibold shadow-[0_12px_32px_-12px_var(--honey)]"
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
