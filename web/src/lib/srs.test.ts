import { describe, expect, it } from "vitest";
import { initialState, review, type SrsState } from "@/lib/srs";

const now = new Date("2026-10-03T12:00:00Z");
const DAY_MS = 86_400_000;

const state = (overrides: Partial<SrsState> = {}): SrsState => ({
  ...initialState(now),
  ...overrides,
});

describe("initialState", () => {
  it("starts with ease 2.5, no interval, no reps, due now", () => {
    expect(initialState(now)).toEqual({ ease: 2.5, intervalDays: 0, reps: 0, dueAt: now });
  });
});

describe("review", () => {
  it("Again resets reps and interval, drops ease by 0.2, due in 10 minutes", () => {
    const next = review(state({ ease: 2.5, intervalDays: 15, reps: 4 }), 0, now);
    expect(next.reps).toBe(0);
    expect(next.intervalDays).toBe(0);
    expect(next.ease).toBeCloseTo(2.3);
    expect(next.dueAt).toEqual(new Date(now.getTime() + 10 * 60_000));
  });

  it("Again never drops ease below 1.3", () => {
    expect(review(state({ ease: 1.4 }), 0, now).ease).toBe(1.3);
  });

  it("Good schedules 1 day, then 6 days, then round(6 * ease)", () => {
    const first = review(state(), 2, now);
    expect(first).toMatchObject({ reps: 1, intervalDays: 1, ease: 2.5 });
    expect(first.dueAt).toEqual(new Date(now.getTime() + DAY_MS));

    const second = review(first, 2, now);
    expect(second).toMatchObject({ reps: 2, intervalDays: 6 });

    const third = review(second, 2, now);
    expect(third).toMatchObject({ reps: 3, intervalDays: 15 });
    expect(third.dueAt).toEqual(new Date(now.getTime() + 15 * DAY_MS));
  });

  it("Easy adds 0.15 ease and multiplies the interval by 1.3", () => {
    const next = review(state({ ease: 2.5, intervalDays: 6, reps: 2 }), 3, now);
    expect(next.ease).toBeCloseTo(2.65);
    expect(next.intervalDays).toBe(Math.round(15 * 1.3));
    expect(next.reps).toBe(3);
  });

  it("Hard grows the interval by 1.2 (min 1 day) and drops ease by 0.15", () => {
    const next = review(state({ ease: 2.5, intervalDays: 10, reps: 3 }), 1, now);
    expect(next.intervalDays).toBe(12);
    expect(next.ease).toBeCloseTo(2.35);
    expect(next.reps).toBe(4);

    expect(review(state(), 1, now).intervalDays).toBe(1);
  });

  it("Hard never drops ease below 1.3", () => {
    expect(review(state({ ease: 1.35, intervalDays: 2, reps: 2 }), 1, now).ease).toBe(1.3);
  });
});
