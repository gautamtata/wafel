import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings/settings-form";
import { getLearner } from "@/lib/learner";

export const metadata: Metadata = { title: "Settings · Wafel" };

export default async function SettingsPage() {
  const learner = await getLearner();
  if (!learner) redirect("/onboarding");

  const { level, correctionMode, pace, voice, sessionCapMinutes, nativeLanguage, goals } = learner;
  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="font-display text-[2.75rem] leading-none font-medium tracking-tight sm:text-6xl">
          Settings
        </h1>
        <p className="mt-3 text-muted-foreground">Changes apply from your next session.</p>
      </header>
      <SettingsForm
        initial={{
          level,
          correctionMode,
          pace,
          voice,
          sessionCapMinutes,
          nativeLanguage,
          goals: goals ?? "",
        }}
      />
    </div>
  );
}
