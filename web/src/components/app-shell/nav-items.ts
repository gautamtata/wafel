import { AudioLines, BookOpen, House, type LucideIcon, PenLine, Settings2 } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/practice", label: "Practice", icon: AudioLines },
  { href: "/vocab", label: "Vocab", icon: BookOpen },
  { href: "/mistakes", label: "Mistakes", icon: PenLine },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
