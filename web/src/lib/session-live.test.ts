import type { TextStreamData } from "@livekit/components-react";
import { describe, expect, it } from "vitest";
import { toTurns } from "./session-live";

const stream = (
  id: string,
  identity: string,
  text: string,
  attributes: Record<string, string> = {},
  timestamp = 0,
): TextStreamData => ({
  text,
  participantInfo: { identity },
  streamInfo: { id, topic: "lk.transcription", mimeType: "text/plain", timestamp, attributes, encryptionType: 0 },
});

describe("toTurns", () => {
  it("keeps arrival order and merges streams of the same segment", () => {
    const turns = toTurns([
      stream("a", "agent-x", "Hola", { "lk.segment_id": "seg1" }, 50),
      stream("b", "learner", "Hola, bien", {}, 10),
      stream("c", "agent-x", "Hola, ¿qué tal?", { "lk.segment_id": "seg1", "lk.transcription_final": "true" }, 60),
      stream("d", "agent-x", "   ", { "lk.segment_id": "seg2" }),
    ]);
    expect(turns).toEqual([
      { id: "seg1", role: "tutor", text: "Hola, ¿qué tal?", at: 60, final: true },
      { id: "b", role: "learner", text: "Hola, bien", at: 10, final: false },
    ]);
  });
});
