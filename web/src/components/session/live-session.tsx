"use client";

import {
  RoomAudioRenderer,
  useConnectionState,
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
  useTrackVolume,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatClock,
  type Note,
  NOTE_TOPIC,
  parseNote,
  toTurns,
  TUTOR_ARRIVAL_TIMEOUT_MS,
} from "@/lib/session-live";
import { cn } from "@/lib/utils";
import { NoteStack } from "./note-card";
import { SessionBar } from "./session-bar";
import { StatusBanner } from "./status-banner";
import { TranscriptFeed } from "./transcript-feed";
import { type TutorState, TutorOrb } from "./tutor-orb";

const MAX_NOTES = 3;

type LiveSessionProps = {
  label: string;
  title: string;
  capMinutes: number;
  micError: string | null;
  onTutorMissing: () => void;
};

function useElapsedSeconds(): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return elapsed;
}

function useTutorPresence(present: boolean, onMissing: () => void, onLeft: () => void): void {
  const arrived = useRef(false);
  useEffect(() => {
    if (present) {
      arrived.current = true;
      return;
    }
    if (arrived.current) {
      onLeft();
      return;
    }
    const timer = setTimeout(onMissing, TUTOR_ARRIVAL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [present, onMissing, onLeft]);
}

function useNotes(): { notes: Note[]; dismiss: (id: string) => void } {
  const [notes, setNotes] = useState<Note[]>([]);
  const onMessage = useCallback((message: { payload: Uint8Array }) => {
    const note = parseNote(message.payload);
    if (!note) return;
    setNotes((current) => [...current, { ...note, id: crypto.randomUUID() }].slice(-MAX_NOTES));
  }, []);
  useDataChannel(NOTE_TOPIC, onMessage);
  const dismiss = useCallback(
    (id: string) => setNotes((current) => current.filter((note) => note.id !== id)),
    [],
  );
  return { notes, dismiss };
}

const tutorState = (state: ReturnType<typeof useVoiceAssistant>["state"]): TutorState =>
  state === "speaking" || state === "listening" || state === "thinking" ? state : "idle";

export function LiveSession({ label, title, capMinutes, micError, onTutorMissing }: LiveSessionProps) {
  const room = useRoomContext();
  const connection = useConnectionState();
  const { agent, state, audioTrack } = useVoiceAssistant();
  const level = useTrackVolume(audioTrack);
  const streams = useTranscriptions();
  const turns = useMemo(() => toTurns(streams), [streams]);
  const { notes, dismiss } = useNotes();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const elapsed = useElapsedSeconds();
  const [ending, setEnding] = useState(false);

  const end = useCallback(() => {
    setEnding(true);
    void room.disconnect();
  }, [room]);
  useTutorPresence(agent !== undefined, onTutorMissing, end);

  const capSeconds = capMinutes * 60;
  const overCap = elapsed >= capSeconds;
  const reconnecting = connection === ConnectionState.Reconnecting;

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:px-8">
      <RoomAudioRenderer />
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{label}</p>
          <h1 className="mt-1 truncate font-display text-xl font-medium tracking-tight">{title}</h1>
        </div>
        <p
          className={cn(
            "shrink-0 pt-1 text-sm tabular-nums",
            overCap ? "font-medium text-honey" : "text-muted-foreground",
          )}
          aria-label="Elapsed time"
        >
          {overCap ? "Time's up" : `${formatClock(elapsed)} · ${capMinutes} min`}
        </p>
      </header>

      <div className="mt-3 flex flex-col gap-2 empty:hidden">
        {reconnecting && (
          <StatusBanner icon="offline" title="Reconnecting…" description="Hold on, your tutor is still there." />
        )}
        {micError && <StatusBanner tone="warn" icon="alert" title="Microphone unavailable" description={micError} />}
      </div>

      <div className="flex flex-1 flex-col items-center">
        <div className="flex h-[min(42dvh,22rem)] shrink-0 items-center justify-center">
          <TutorOrb state={tutorState(state)} level={level} className="size-44 sm:size-56" />
        </div>
        <TranscriptFeed
          turns={turns}
          className="w-full max-w-xl flex-1 basis-0 pt-5 pb-4 [mask-image:linear-gradient(to_bottom,transparent,black_1.25rem)]"
        />
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pt-3">
        <NoteStack notes={notes} onDismiss={dismiss} />
        <SessionBar
          muted={!isMicrophoneEnabled}
          onToggleMute={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          onEnd={end}
          ending={ending}
        />
      </div>
    </div>
  );
}
