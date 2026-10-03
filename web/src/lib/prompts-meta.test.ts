import { describe, expect, it } from "vitest";
import { VOICES } from "@/lib/prompts-meta";

describe("VOICES", () => {
  it("lists the realtime voices once each, with labels and descriptions", () => {
    expect(VOICES.map((v) => v.id)).toEqual([
      "marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse",
      "beacon", "cinder", "stone", "vesper", "quartz", "ripple", "willow", "gleam", "meridian",
      "bossa", "tempo", "delta",
    ]);
    for (const voice of VOICES) {
      expect(voice.label).not.toBe("");
      expect(voice.description).not.toBe("");
    }
  });
});
