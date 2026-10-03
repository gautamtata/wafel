import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { TabBar } from "@/components/app-shell/tab-bar";
import { TopBar } from "@/components/app-shell/top-bar";
import { getLearner } from "@/lib/learner";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const learner = await getLearner();
  if (!learner?.onboardedAt) redirect("/onboarding");

  return (
    <>
      <TopBar />
      <TabBar />
      <main className="md:pl-60">
        <div className="mx-auto w-full max-w-[720px] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] sm:px-8 md:pt-16 md:pb-20">
          {children}
        </div>
      </main>
    </>
  );
}
