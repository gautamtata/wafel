import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app-shell/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { getLearner } from "@/lib/learner";

export const metadata: Metadata = { title: "Settings · Wafel" };

export default async function SettingsPage() {
  const learner = await getLearner();
  if (!learner) redirect("/onboarding");

  const { level, correctionMode, pace, voice, sessionCapMinutes, nativeLanguage, goals } = learner;
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Settings" subtitle="Changes apply from your next session." />
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
