"use client";

import { useClientValue } from "@/hooks/use-hydrated";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function Greeting({ subtitle }: { subtitle: string }) {
  const greeting = useClientValue(() => greetingFor(new Date().getHours()));
  const date = useClientValue(() => DATE_FORMAT.format(new Date()));

  return (
    <header>
      <p className="eyebrow">{date ?? " "}</p>
      <h1 className="mt-2 font-display text-[2.75rem] leading-none font-medium tracking-tight sm:text-6xl">
        {greeting ?? "Hola"}
        <span className="text-honey">.</span>
      </h1>
      <p className="mt-3 text-muted-foreground">{subtitle}</p>
    </header>
  );
}
