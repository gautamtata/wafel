import { describe, expect, it } from "vitest";
import { hasRecapPage, sessionHref, suggestionHref } from "@/lib/links";

describe("sessionHref", () => {
  it("sends open sessions to the room", () => {
    expect(sessionHref("s1", "CREATED")).toBe("/session/s1");
    expect(sessionHref("s1", "ACTIVE")).toBe("/session/s1");
  });

  it("sends finished sessions to the recap page, where the retry lives", () => {
    expect(sessionHref("s1", "ENDED")).toBe("/session/s1/recap");
    expect(sessionHref("s1", "RECAP_READY")).toBe("/session/s1/recap");
    expect(sessionHref("s1", "FAILED")).toBe("/session/s1/recap");
  });

  it("hasRecapPage matches sessionHref", () => {
    for (const status of ["CREATED", "ACTIVE", "ENDED", "RECAP_READY", "FAILED"] as const) {
      expect(hasRecapPage(status)).toBe(sessionHref("s1", status).endsWith("/recap"));
    }
  });
});

describe("suggestionHref", () => {
  it("routes vocab review to the deck and everything else to practice", () => {
    expect(suggestionHref({ type: "VOCAB_REVIEW" } as never)).toBe("/vocab");
    expect(suggestionHref({ type: "LESSON", topic: "Food" } as never)).toBe("/practice?type=LESSON&topic=Food");
  });
});
