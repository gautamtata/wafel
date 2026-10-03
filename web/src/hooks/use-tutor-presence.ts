import { useEffect, useRef, useState } from "react";
import { TUTOR_ARRIVAL_TIMEOUT_MS } from "@/lib/session-live";

type Handlers = { onMissing: () => void; onLeft: () => void };

export function useTutorPresence(present: boolean, connected: boolean, { onMissing, onLeft }: Handlers): void {
  const arrived = useRef(false);
  const fired = useRef(false);

  useEffect(() => {
    if (present) {
      arrived.current = true;
      return;
    }
    if (!connected) return;
    if (arrived.current) {
      onLeft();
      return;
    }
    if (fired.current) return;
    const timer = setTimeout(() => {
      fired.current = true;
      onMissing();
    }, TUTOR_ARRIVAL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [present, connected, onMissing, onLeft]);
}

export function useElapsedSeconds(running: boolean): number {
  const startedAt = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    startedAt.current ??= Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000));
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [running]);
  return elapsed;
}
