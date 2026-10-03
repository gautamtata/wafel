import type { ComponentProps } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function QuietSwitch({ className, ...props }: ComponentProps<typeof Switch>) {
  return <Switch className={cn("data-checked:bg-foreground", className)} {...props} />;
}
