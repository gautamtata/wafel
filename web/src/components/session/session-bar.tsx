"use client";

import { Mic, MicOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SessionBarProps = {
  muted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
  ending: boolean;
};

export function SessionBar({ muted, onToggleMute, onEnd, ending }: SessionBarProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        type="button"
        variant="outline"
        aria-pressed={muted}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        onClick={onToggleMute}
        className={cn(
          "size-14 rounded-full",
          muted && "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15",
        )}
      >
        {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
      </Button>
      <Button
        type="button"
        onClick={onEnd}
        disabled={ending}
        className="h-14 rounded-full bg-foreground px-7 text-base font-semibold text-background hover:bg-foreground/90"
      >
        <PhoneOff data-icon="inline-start" />
        End
      </Button>
    </div>
  );
}
