import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStatus } from "./use-session-status";

const respond = (status: string) =>
  Promise.resolve(new Response(JSON.stringify({ id: "s1", status }), { status: 200 }));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("useSessionStatus", () => {
  it("polls every 2 s until RECAP_READY", async () => {
    fetchMock.mockImplementationOnce(() => respond("ACTIVE"));
    fetchMock.mockImplementationOnce(() => respond("ENDED"));
    fetchMock.mockImplementation(() => respond("RECAP_READY"));
    const { result } = renderHook(() => useSessionStatus("s1", true));
    expect(result.current).toBe("polling");
    await tick(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/sessions/s1");
    await tick(2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toBe("polling");
    await tick(2000);
    expect(result.current).toBe("ready");
    await tick(4000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports FAILED", async () => {
    fetchMock.mockImplementation(() => respond("FAILED"));
    const { result } = renderHook(() => useSessionStatus("s1", true));
    await tick(0);
    expect(result.current).toBe("failed");
  });

  it("times out after 60 s of non-terminal statuses", async () => {
    fetchMock.mockImplementation(() => respond("ENDED"));
    const { result } = renderHook(() => useSessionStatus("s1", true));
    await tick(59_000);
    expect(result.current).toBe("polling");
    await tick(2000);
    expect(result.current).toBe("timeout");
  });

  it("does nothing while disabled", async () => {
    const { result } = renderHook(() => useSessionStatus("s1", false));
    await tick(5000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toBe("idle");
  });
});
