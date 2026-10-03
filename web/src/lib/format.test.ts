import { describe, expect, it } from "vitest";
import { formatCents, formatDay, formatDueIn, formatDuration, formatSpan } from "@/lib/format";

describe("format", () => {
  it("formats cents and durations", () => {
    expect(formatCents(340)).toBe("$3.40");
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(30)).toBe("<1 min");
    expect(formatDuration(720)).toBe("12 min");
  });

  it("labels days in the injected zone", () => {
    const now = new Date("2026-10-04T02:00:00Z");
    const evening = new Date("2026-10-02T23:30:00Z");
    expect(formatDay(new Date("2026-10-04T01:30:00Z"), now, "America/Los_Angeles")).toBe("Today");
    expect(formatDay(evening, now, "America/Los_Angeles")).toBe("Yesterday");
    expect(formatDay(evening, now, "UTC")).toBe("Fri, Oct 2");
    expect(formatDay(new Date("2026-09-29T20:00:00Z"), now, "America/Los_Angeles")).toBe(
      "Tue, Sep 29",
    );
  });
});

describe("relative spans", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const later = (ms: number) => new Date(now.getTime() + ms);

  it("formats spans compactly", () => {
    expect(formatSpan(10 * 60_000)).toBe("10 min");
    expect(formatSpan(5 * 3_600_000)).toBe("5 hr");
    expect(formatSpan(86_400_000)).toBe("1 day");
    expect(formatSpan(86_400_000 - 5 * 60_000)).toBe("1 day");
    expect(formatSpan(59.8 * 60_000)).toBe("1 hr");
    expect(formatSpan(6 * 86_400_000)).toBe("6 days");
    expect(formatSpan(60 * 86_400_000)).toBe("2 mo");
    expect(formatSpan(800 * 86_400_000)).toBe("2 yr");
  });

  it("labels due dates relative to now", () => {
    expect(formatDueIn(now, now)).toBe("Due now");
    expect(formatDueIn(later(-3_600_000), now)).toBe("Due now");
    expect(formatDueIn(later(30 * 60_000), now)).toBe("in 30 min");
    expect(formatDueIn(later(3 * 86_400_000), now)).toBe("in 3 days");
  });
});
