import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TUTOR_ARRIVAL_TIMEOUT_MS } from "@/lib/session-live";
import { useElapsedSeconds, useTutorPresence } from "./use-tutor-presence";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type Props = { present: boolean; connected: boolean };

const setup = (initial: Props) => {
  const onMissing = vi.fn();
  const onLeft = vi.fn();
  const hook = renderHook(
    ({ present, connected }: Props) => useTutorPresence(present, connected, { onMissing, onLeft }),
    { initialProps: initial },
  );
  return { ...hook, onMissing, onLeft };
};

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("useTutorPresence", () => {
  it("does not arm the arrival timer before the room is connected", () => {
    const { onMissing, rerender } = setup({ present: false, connected: false });
    advance(TUTOR_ARRIVAL_TIMEOUT_MS * 2);
    expect(onMissing).not.toHaveBeenCalled();
    rerender({ present: false, connected: true });
    advance(TUTOR_ARRIVAL_TIMEOUT_MS - 1);
    expect(onMissing).not.toHaveBeenCalled();
    advance(1);
    expect(onMissing).toHaveBeenCalledTimes(1);
  });

  it("fires once and is not re-armed", () => {
    const { onMissing, rerender } = setup({ present: false, connected: true });
    advance(TUTOR_ARRIVAL_TIMEOUT_MS);
    rerender({ present: false, connected: false });
    rerender({ present: false, connected: true });
    advance(TUTOR_ARRIVAL_TIMEOUT_MS);
    expect(onMissing).toHaveBeenCalledTimes(1);
  });

  it("clears the timer when the tutor arrives", () => {
    const { onMissing, onLeft, rerender } = setup({ present: false, connected: true });
    advance(TUTOR_ARRIVAL_TIMEOUT_MS / 2);
    rerender({ present: true, connected: true });
    advance(TUTOR_ARRIVAL_TIMEOUT_MS);
    expect(onMissing).not.toHaveBeenCalled();
    expect(onLeft).not.toHaveBeenCalled();
  });

  it("ignores the tutor vanishing during a reconnect, but ends when they leave a connected room", () => {
    const { onLeft, rerender } = setup({ present: true, connected: true });
    rerender({ present: false, connected: false });
    expect(onLeft).not.toHaveBeenCalled();
    rerender({ present: true, connected: true });
    rerender({ present: false, connected: true });
    expect(onLeft).toHaveBeenCalledTimes(1);
  });
});

describe("useElapsedSeconds", () => {
  it("counts from the moment the room connects", () => {
    const { result, rerender } = renderHook((running: boolean) => useElapsedSeconds(running), {
      initialProps: false,
    });
    advance(5000);
    expect(result.current).toBe(0);
    rerender(true);
    advance(3000);
    expect(result.current).toBe(3);
  });
});
