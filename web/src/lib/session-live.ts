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

const roleOf = (identity: string): TurnRole => (identity === LEARNER_IDENTITY ? "learner" : "tutor");

export function toTurns(streams: readonly TextStreamData[]): Turn[] {
  return streams
    .filter((stream) => stream.text.trim().length > 0)
    .map(({ text, participantInfo, streamInfo }) => ({
      id: streamInfo.id,
      role: roleOf(participantInfo.identity),
      text: text.trim(),
      at: streamInfo.timestamp,
      final: streamInfo.attributes?.[FINAL_ATTRIBUTE] === "true",
    }))
    .sort((a, b) => a.at - b.at);
}

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
