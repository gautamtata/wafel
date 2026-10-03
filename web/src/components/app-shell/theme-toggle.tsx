"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Segmented } from "@/components/forms/segmented";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className="size-11 rounded-full text-muted-foreground hover:text-foreground"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Moon className="size-[1.15rem] dark:hidden" />
      <Sun className="hidden size-[1.15rem] dark:block" />
    </Button>
  );
}

const THEMES = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

type ThemeName = (typeof THEMES)[number]["value"];

export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  return (
    <Segmented<ThemeName>
      name="theme"
      label="Theme"
      value={hydrated ? ((theme as ThemeName | undefined) ?? "system") : null}
      onChange={setTheme}
      options={THEMES}
    />
  );
}
