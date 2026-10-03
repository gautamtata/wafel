import type { TextStreamData } from "@livekit/components-react";
import { z } from "zod";

export const LEARNER_IDENTITY = "learner";
export const NOTE_TOPIC = "wafel.note";
export const PHRASE_TOPIC = "wafel.phrase";
export const TUTOR_ARRIVAL_TIMEOUT_MS = 10_000;

export type TurnRole = "tutor" | "learner";
export type Turn = { id: string; role: TurnRole; text: string; at: number; final: boolean };
export type Note = { id: string; title: string; body: string };
export type Phrase = { id: string; spanish: string; english: string };

const noteSchema = z.object({ type: z.literal("note"), title: z.string(), body: z.string() });
const phraseSchema = z.object({
  type: z.literal("phrase"),
  spanish: z.string().trim().min(1),
  english: z.string().trim().min(1),
});

function decode<T>(schema: z.ZodType<T>, payload: Uint8Array): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(new TextDecoder().decode(payload)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseNote(payload: Uint8Array): Omit<Note, "id"> | null {
  const note = decode(noteSchema, payload);
  return note && { title: note.title, body: note.body };
}

export function parsePhrase(payload: Uint8Array): Omit<Phrase, "id"> | null {
  const phrase = decode(phraseSchema, payload);
  return phrase && { spanish: phrase.spanish, english: phrase.english };
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
