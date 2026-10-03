import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { unitContentSchema, unitFileSchema, unitLevelOf } from "@/lib/unit-schema";

const placeholder = JSON.parse(readFileSync("content/units/es-MX/A1.json", "utf8")) as unknown[];

describe("unit content schema", () => {
  it("accepts the shipped placeholder unit", () => {
    const parsed = unitFileSchema.parse(placeholder);
    expect(parsed[0].id).toBe("es-MX-A1-01");
    expect(parsed[0].targetWords).toHaveLength(12);
    expect(unitLevelOf(parsed[0])).toBe("A1");
  });

  it("rejects a unit with too few words, wrong sentence count or a bad id", () => {
    const unit = unitContentSchema.parse(placeholder[0]);
    expect(unitContentSchema.safeParse({ ...unit, targetWords: unit.targetWords.slice(0, 9) }).success).toBe(false);
    expect(unitContentSchema.safeParse({ ...unit, modelSentences: unit.modelSentences.slice(0, 4) }).success).toBe(false);
    expect(unitContentSchema.safeParse({ ...unit, id: "unit-1" }).success).toBe(false);
    expect(unitContentSchema.safeParse({ ...unit, pattern: { ...unit.pattern, examples: [] } }).success).toBe(false);
  });

  it("rejects duplicate words within a unit and duplicate ids across a file", () => {
    const unit = unitContentSchema.parse(placeholder[0]);
    const dup = [...unit.targetWords.slice(0, 11), unit.targetWords[0]];
    expect(unitContentSchema.safeParse({ ...unit, targetWords: dup }).success).toBe(false);
    expect(unitFileSchema.safeParse([unit, { ...unit, order: 2 }]).success).toBe(false);
    expect(unitFileSchema.safeParse([unit, { ...unit, id: "es-MX-A1-02" }]).success).toBe(false);
  });
});
