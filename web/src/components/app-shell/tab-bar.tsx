"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:inset-y-0 md:right-auto md:flex md:w-60 md:flex-col md:border-t-0 md:border-r md:bg-background md:pb-0 md:backdrop-blur-none"
    >
      <div className="hidden px-7 pt-9 pb-12 md:block">
        <Wordmark className="text-3xl" />
      </div>
      <ul className="grid grid-cols-5 px-1 md:flex md:flex-col md:gap-1 md:px-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex flex-col items-center gap-1 pt-2 pb-1.5 text-[0.6875rem] font-medium text-muted-foreground transition-colors md:flex-row md:gap-3 md:rounded-xl md:px-3 md:py-2.5 md:text-sm",
                  active
                    ? "text-foreground md:bg-primary md:text-primary-foreground"
                    : "hover:text-foreground md:hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors md:size-auto",
                    active && "bg-primary text-primary-foreground md:bg-transparent",
                  )}
                >
                  <Icon className="size-[1.15rem]" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto hidden px-4 pb-6 md:block">
        <ThemeToggle />
      </div>
    </nav>
  );
}
