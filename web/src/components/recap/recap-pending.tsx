"use client";

import { NotebookPen, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app-shell/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { send } from "@/lib/client-fetch";
import { cn } from "@/lib/utils";

const POLL_MS = 3_000;
const POLL_LIMIT_MS = 60_000;

export function RecapPending({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (timedOut) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt >= POLL_LIMIT_MS) setTimedOut(true);
      else router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [router, timedOut]);

  async function retry() {
    setRetrying(true);
    try {
      await send(`/api/sessions/${sessionId}/recap`, "POST");
      router.refresh();
    } catch {
      toast.error("The recap still didn't come through. Try again in a moment.");
    }
    setRetrying(false);
  }

  return (
    <EmptyState
      icon={NotebookPen}
      className="mt-6 py-16"
      title={
        timedOut ? (
          "This is taking longer than usual"
        ) : (
          <ShimmeringText text="Preparing your recap…" duration={2.4} />
        )
      }
      actions={
        <>
          <Button
            variant={timedOut ? "default" : "outline"}
            onClick={retry}
            disabled={retrying}
            className={cn("h-11 rounded-xl px-5 text-base", timedOut && "font-semibold")}
          >
            <RotateCw className={cn(retrying && "animate-spin")} />
            {retrying ? "Retrying…" : "Retry"}
          </Button>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "h-11 rounded-xl px-5 text-base")}>
            Home
          </Link>
        </>
      }
    >
      {timedOut
        ? "Your session is saved. Retry to build the recap now."
        : "Your tutor is writing up corrections and new words. This usually takes a few seconds."}
    </EmptyState>
  );
}
