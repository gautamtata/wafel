import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
      <div className="flex h-14 items-center justify-between pr-2.5 pl-5">
        <Wordmark />
        <ThemeToggle />
      </div>
    </header>
  );
}
