import { describe, expect, it } from "vitest";
import { parseLearnerUpdate } from "@/lib/learner";

describe("parseLearnerUpdate", () => {
  it("accepts a full onboarding payload", () => {
    const onboardedAt = "2026-10-03T18:00:00.000Z";
    const result = parseLearnerUpdate({
      targetLanguage: "es",
      nativeLanguage: "en",
      level: "A2",
      voice: "marin",
      correctionMode: "SUBTLE",
      pace: "SLOW",
      goals: "  Talk with my in-laws  ",
      onboardedAt,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        targetLanguage: "es",
        nativeLanguage: "en",
        level: "A2",
        voice: "marin",
        correctionMode: "SUBTLE",
        pace: "SLOW",
        goals: "Talk with my in-laws",
        onboardedAt: new Date(onboardedAt),
      },
    });
  });

  it("accepts a dialect", () => {
    expect(parseLearnerUpdate({ dialect: "ES" })).toEqual({ ok: true, data: { dialect: "ES" } });
  });

  it("accepts a partial update and clears empty goals", () => {
    expect(parseLearnerUpdate({ level: "B1", sessionCapMinutes: 30, goals: " " })).toEqual({
      ok: true,
      data: { level: "B1", sessionCapMinutes: 30, goals: null },
    });
  });

  it("ignores unknown and protected keys", () => {
    expect(parseLearnerUpdate({ id: "someone", createdAt: "x", pace: "NATURAL" })).toEqual({
      ok: true,
      data: { pace: "NATURAL" },
    });
  });

  it.each([
    [{ level: "D1" }, "level"],
    [{ dialect: "AR" }, "dialect"],
    [{ correctionMode: "LOUD" }, "correctionMode"],
    [{ pace: 3 }, "pace"],
    [{ voice: "robot" }, "voice"],
    [{ sessionCapMinutes: 2 }, "sessionCapMinutes"],
    [{ sessionCapMinutes: 12.5 }, "sessionCapMinutes"],
    [{ nativeLanguage: "" }, "nativeLanguage"],
    [{ targetLanguage: 7 }, "targetLanguage"],
    [{ onboardedAt: "yesterday-ish" }, "onboardedAt"],
    [{ goals: "x".repeat(501) }, "goals"],
  ])("rejects %j", (body, field) => {
    expect(parseLearnerUpdate(body)).toEqual({ ok: false, error: `Invalid ${field}` });
  });

  it("rejects non-object bodies", () => {
    expect(parseLearnerUpdate(null)).toEqual({ ok: false, error: "Expected an object" });
    expect(parseLearnerUpdate([])).toEqual({ ok: false, error: "Expected an object" });
  });
});
