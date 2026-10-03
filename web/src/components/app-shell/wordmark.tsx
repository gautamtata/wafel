import Link from "next/link";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("font-display text-2xl font-medium tracking-tight", className)}
    >
      Wafel<span className="text-honey">.</span>
    </Link>
  );
}
