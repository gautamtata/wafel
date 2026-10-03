import { House } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { Wordmark } from "@/components/app-shell/wordmark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RecapTopBar() {
  return (
    <header className="sticky top-0 z-30 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[720px] items-center justify-between pr-2.5 pl-5 sm:h-16 sm:pr-6 sm:pl-8">
        <Wordmark />
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-11 rounded-full px-4 text-sm text-muted-foreground hover:text-foreground",
            )}
          >
            <House className="size-4" strokeWidth={1.75} />
            Home
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
