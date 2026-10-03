import { describe, expect, it } from "vitest";
import { levelIndex, levelsUpTo } from "./levels";

describe("CEFR levels", () => {
  it("orders CEFR levels", () => {
    expect(levelIndex("A1")).toBeLessThan(levelIndex("B2"));
    expect(levelIndex("C2")).toBe(5);
  });

  it("lists the levels a learner can play", () => {
    expect(levelsUpTo("A1")).toEqual(["A1"]);
    expect(levelsUpTo("B1")).toEqual(["A1", "A2", "B1"]);
  });
});
