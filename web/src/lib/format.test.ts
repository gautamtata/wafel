import { describe, expect, it } from "vitest";
import { formatCents, formatDay, formatDuration } from "@/lib/format";

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
