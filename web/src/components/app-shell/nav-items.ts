import { AudioLines, BookOpen, House, type LucideIcon, Map as MapIcon, PenLine, Settings2 } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** The five mobile tabs; Settings lives in the top bar on mobile and the sidebar footer on desktop. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/path", label: "Path", icon: MapIcon },
  { href: "/practice", label: "Practice", icon: AudioLines },
  { href: "/vocab", label: "Vocab", icon: BookOpen },
  { href: "/mistakes", label: "Mistakes", icon: PenLine },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings2 };

export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
