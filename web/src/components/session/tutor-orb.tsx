"use client";

import dynamic from "next/dynamic";
import type { AgentState as OrbState } from "@/components/ui/orb";
import { cn } from "@/lib/utils";

export type TutorState = "idle" | "listening" | "thinking" | "speaking";

const Orb = dynamic(() => import("@/components/ui/orb").then((m) => m.Orb), { ssr: false });

const COLORS: Record<"active" | "dim", [string, string]> = {
  active: ["#D9A441", "#F6E7CC"],
  dim: ["#E9C27A", "#F6E7CC"],
};

const ORB_STATE: Record<TutorState, OrbState> = {
  idle: null,
  listening: "listening",
  thinking: "thinking",
  speaking: "talking",
};

type TutorOrbProps = { state: TutorState; level: number; className?: string };

export function TutorOrb({ state, level, className }: TutorOrbProps) {
  const speaking = state === "speaking";
  const glow = speaking ? 0.45 + Math.min(level, 1) * 0.55 : state === "idle" ? 0.12 : 0.22;
  return (
    <div aria-hidden className={cn("relative shrink-0", className)}>
      <div
        className="absolute -inset-[18%] rounded-full bg-honey blur-3xl transition-opacity duration-300"
        style={{ opacity: glow }}
      />
      <div
        className={cn(
          "absolute inset-[10%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#f6e7cc,#e9c27a_75%)] blur-[2px] transition-opacity duration-500",
          speaking ? "opacity-90" : "opacity-55",
        )}
      />
      <Orb
        colors={speaking ? COLORS.active : COLORS.dim}
        seed={7}
        agentState={ORB_STATE[state]}
        className={cn("relative size-full transition-opacity duration-500", state === "idle" && "opacity-80")}
      />
    </div>
  );
}
