import { describe, expect, it } from "vitest";
import { appTimeZone, dayNumber, DEFAULT_TIME_ZONE, midnightOf, weekday } from "@/lib/timezone";

const LA = "America/Los_Angeles";

describe("timezone", () => {
  it("defaults to the owner's zone", () => {
    const previous = process.env.APP_TIME_ZONE;
    delete process.env.APP_TIME_ZONE;
    expect(appTimeZone()).toBe(DEFAULT_TIME_ZONE);
    process.env.APP_TIME_ZONE = "Europe/Madrid";
    expect(appTimeZone()).toBe("Europe/Madrid");
    if (previous === undefined) delete process.env.APP_TIME_ZONE;
    else process.env.APP_TIME_ZONE = previous;
  });

  it("assigns instants to the zone's calendar day", () => {
    const evening = new Date("2026-10-04T01:30:00Z");
    expect(dayNumber(evening, LA)).toBe(dayNumber(new Date("2026-10-03T12:00:00Z"), "UTC"));
    expect(dayNumber(evening, "UTC")).toBe(dayNumber(new Date("2026-10-04T12:00:00Z"), "UTC"));
    expect(weekday(evening, LA)).toBe(6);
  });

  it("finds local midnight across DST", () => {
    const day = dayNumber(new Date("2026-10-03T12:00:00Z"), "UTC");
    expect(midnightOf(day, LA).toISOString()).toBe("2026-10-03T07:00:00.000Z");
    const winter = dayNumber(new Date("2026-12-01T12:00:00Z"), "UTC");
    expect(midnightOf(winter, LA).toISOString()).toBe("2026-12-01T08:00:00.000Z");
    const springForward = dayNumber(new Date("2026-03-08T12:00:00Z"), "UTC");
    expect(midnightOf(springForward, LA).toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(midnightOf(day, "UTC").toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });
});
