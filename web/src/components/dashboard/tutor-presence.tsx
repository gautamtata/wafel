"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const ORB_COLORS: [string, string] = ["#E9C27A", "#F6E7CC"];

const Orb = dynamic(() => import("@/components/ui/orb").then((m) => m.Orb), { ssr: false });

export function TutorPresence({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative shrink-0", className)}>
      <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#f6e7cc,#e9c27a_75%)] opacity-70 blur-[2px]" />
      <Orb colors={ORB_COLORS} seed={7} className="relative size-full" />
    </div>
  );
}
