import type { TextStreamData } from "@livekit/components-react";
import { z } from "zod";

export const LEARNER_IDENTITY = "learner";
export const NOTE_TOPIC = "wafel.note";
export const TUTOR_ARRIVAL_TIMEOUT_MS = 10_000;

export type TurnRole = "tutor" | "learner";
export type Turn = { id: string; role: TurnRole; text: string; at: number; final: boolean };
export type Note = { id: string; title: string; body: string };

const noteSchema = z.object({ type: z.literal("note"), title: z.string(), body: z.string() });

export function parseNote(payload: Uint8Array): Omit<Note, "id"> | null {
  try {
    const parsed = noteSchema.safeParse(JSON.parse(new TextDecoder().decode(payload)));
    return parsed.success ? { title: parsed.data.title, body: parsed.data.body } : null;
  } catch {
    return null;
  }
}

const FINAL_ATTRIBUTE = "lk.transcription_final";
const SEGMENT_ATTRIBUTE = "lk.segment_id";

const roleOf = (identity: string): TurnRole => (identity === LEARNER_IDENTITY ? "learner" : "tutor");

export function toTurns(streams: readonly TextStreamData[]): Turn[] {
  const bySegment = new Map<string, Turn>();
  for (const { text, participantInfo, streamInfo } of streams) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    const id = streamInfo.attributes?.[SEGMENT_ATTRIBUTE] ?? streamInfo.id;
    bySegment.set(id, {
      id,
      role: roleOf(participantInfo.identity),
      text: trimmed,
      at: streamInfo.timestamp,
      final: streamInfo.attributes?.[FINAL_ATTRIBUTE] === "true",
    });
  }
  return [...bySegment.values()];
}

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
