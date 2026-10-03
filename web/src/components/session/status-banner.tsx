import { Loader2, type LucideIcon, TriangleAlert, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "warn";

type StatusBannerProps = {
  tone?: Tone;
  icon?: "spinner" | "offline" | "alert";
  title: string;
  description?: string;
  action?: ReactNode;
};

const ICONS: Record<NonNullable<StatusBannerProps["icon"]>, LucideIcon> = {
  spinner: Loader2,
  offline: WifiOff,
  alert: TriangleAlert,
};

export function StatusBanner({ tone = "info", icon, title, description, action }: StatusBannerProps) {
  const Icon = icon ? ICONS[icon] : null;
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-2xl px-4 py-3.5 text-sm shadow-soft ring-1 sm:flex-row sm:items-center",
        tone === "warn" ? "bg-card ring-destructive/30" : "bg-card ring-foreground/10",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {Icon && (
          <Icon
            className={cn(
              "mt-0.5 size-4 shrink-0",
              icon === "spinner" && "animate-spin",
              tone === "warn" ? "text-destructive" : "text-muted-foreground",
            )}
          />
        )}
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          {description && <p className="mt-0.5 text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 gap-2 sm:ml-auto">{action}</div>}
    </div>
  );
}
