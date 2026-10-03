import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { listLanguages } from "@/lib/languages";
import { getLearner } from "@/lib/learner";

export const metadata: Metadata = { title: "Welcome · Wafel" };

export default async function OnboardingPage() {
  await connection();
  const [learner, languages] = await Promise.all([getLearner(), listLanguages()]);
  if (learner?.onboardedAt) redirect("/");
  return <OnboardingFlow languages={languages} />;
}
