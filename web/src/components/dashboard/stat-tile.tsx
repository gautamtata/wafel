import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type StatTileProps = {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  href?: string;
};

export function StatTile({ label, value, unit, icon: Icon, href }: StatTileProps) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={2} />
        <span className="text-xs font-medium">{label}</span>
      </span>
      <span className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-[2rem] leading-none font-medium tracking-tight tabular-nums">
          {value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </span>
    </>
  );
  const className = cn(
    "flex flex-col rounded-2xl bg-card p-4 shadow-soft ring-1 ring-foreground/5",
    href && "transition-shadow hover:shadow-lift",
  );
  return href ? (
    <Link href={href} data-slot="stat" className={className}>
      {body}
    </Link>
  ) : (
    <div data-slot="stat" className={className}>
      {body}
    </div>
  );
}
