import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, children, actions, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-foreground/70">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="mt-4 font-display text-xl font-medium tracking-tight text-balance">{title}</p>
      {children && (
        <div className="mt-1.5 max-w-[38ch] text-sm text-pretty text-muted-foreground">{children}</div>
      )}
      {actions && (
        <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center">
          {actions}
        </div>
      )}
    </div>
  );
}
