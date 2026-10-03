"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, SETTINGS_ITEM } from "./nav-items";

export function SettingsLink() {
  const active = isActive(SETTINGS_ITEM.href, usePathname());
  const Icon = SETTINGS_ITEM.icon;
  return (
    <Link
      href={SETTINGS_ITEM.href}
      aria-label={SETTINGS_ITEM.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex size-11 items-center justify-center rounded-full transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-[1.15rem]" strokeWidth={active ? 2.25 : 1.75} />
    </Link>
  );
}
