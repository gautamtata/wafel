import { describe, expect, it } from "vitest";
import type { MistakeCategory } from "@/generated/prisma/enums";
import { groupMistakes } from "@/lib/mistake-categories";

const row = (id: string, category: MistakeCategory, resolved = false) => ({ id, category, resolved });

describe("groupMistakes", () => {
  it("groups by category, largest first, keeping row order", () => {
    const groups = groupMistakes([
      row("a", "GRAMMAR"),
      row("b", "CONJUGATION"),
      row("c", "CONJUGATION", true),
      row("d", "GRAMMAR"),
      row("e", "CONJUGATION"),
      row("f", "AGREEMENT"),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["CONJUGATION", "GRAMMAR", "AGREEMENT"]);
    expect(groups[0]).toMatchObject({ label: "Conjugation", openCount: 2 });
    expect(groups[0].mistakes.map((m) => m.id)).toEqual(["b", "c", "e"]);
    expect(groups[1].mistakes.map((m) => m.id)).toEqual(["a", "d"]);
  });

  it("breaks ties by category order and returns nothing for no mistakes", () => {
    const groups = groupMistakes([row("x", "OTHER"), row("y", "VOCABULARY")]);
    expect(groups.map((g) => g.category)).toEqual(["VOCABULARY", "OTHER"]);
    expect(groupMistakes([])).toEqual([]);
  });
});
