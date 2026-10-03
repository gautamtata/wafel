"use client";

import { ArrowLeft, Mic } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TutorOrb } from "./tutor-orb";

type PreStartProps = {
  label: string;
  title: string;
  capMinutes: number;
  onStart: () => void;
};

export function PreStart({ label, title, capMinutes, onStart }: PreStartProps) {
  return (
    <div className="flex min-h-dvh flex-col px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <Link
        href="/practice"
        className="flex h-11 w-fit items-center gap-1.5 rounded-full pr-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Practice
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <TutorOrb state="idle" level={0} className="size-40 sm:size-48" />
        <p className="eyebrow mt-10">{label}</p>
        <h1 className="mt-3 max-w-[18ch] font-display text-[2.25rem] leading-[1.05] font-medium tracking-tight text-balance sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-[34ch] text-pretty text-muted-foreground">
          Up to {capMinutes} minutes, all spoken. Find somewhere quiet and keep your phone awake.
        </p>
      </div>

      <div className="mx-auto w-full max-w-sm">
        <Button
          type="button"
          onClick={onStart}
          className="h-14 w-full rounded-2xl text-base font-semibold shadow-[0_14px_36px_-14px_var(--honey)]"
        >
          <Mic data-icon="inline-start" />
          Start lesson
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Wafel will ask to use your microphone.
        </p>
      </div>
    </div>
  );
}
