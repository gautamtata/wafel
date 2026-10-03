import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOTE_TOPIC, PHRASE_TOPIC } from "@/lib/session-live";
import { LiveSession } from "./live-session";

type Listener = (message: { payload: Uint8Array }) => void;
const listeners = new Map<string, Listener>();

vi.mock("@livekit/components-react", () => ({
  RoomAudioRenderer: () => null,
  useConnectionState: () => "connected",
  useDataChannel: (topic: string, onMessage: Listener) => listeners.set(topic, onMessage),
  useLocalParticipant: () => ({ isMicrophoneEnabled: true, localParticipant: { setMicrophoneEnabled: vi.fn() } }),
  useRoomContext: () => ({ disconnect: vi.fn() }),
  useTrackVolume: () => 0,
  useTranscriptions: () => [],
  useVoiceAssistant: () => ({ agent: {}, state: "listening", audioTrack: undefined }),
}));
vi.mock("@/hooks/use-tutor-presence", () => ({ useTutorPresence: vi.fn(), useElapsedSeconds: () => 0 }));
vi.mock("./tutor-orb", () => ({
  TutorOrb: ({ className }: { className?: string }) => <div data-testid="orb" className={className} />,
}));

afterEach(() => {
  cleanup();
  listeners.clear();
});

const send = (topic: string, value: unknown) =>
  act(() => listeners.get(topic)?.({ payload: new TextEncoder().encode(JSON.stringify(value)) }));

const renderSession = () =>
  render(<LiveSession label="Lesson" title="Last weekend" capMinutes={15} micError={null} onTutorMissing={vi.fn()} />);

describe("LiveSession phrase and notes", () => {
  it("replaces the note stack with the phrase card until the phrase is dismissed", () => {
    renderSession();
    send(NOTE_TOPIC, { type: "note", title: "Pretérito", body: "Finished actions." });
    expect(screen.getByRole("heading", { name: "Pretérito" })).toBeInTheDocument();

    send(PHRASE_TOPIC, { type: "phrase", spanish: "Ayer fui al mercado", english: "Yesterday I went to the market" });
    expect(screen.getByText("Ayer fui al mercado")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pretérito" })).not.toBeInTheDocument();

    send(NOTE_TOPIC, { type: "note", title: "Ir en pretérito", body: "fui, fuiste, fue" });
    send(PHRASE_TOPIC, { type: "phrase", spanish: "Anoche salí", english: "Last night I went out" });
    expect(screen.queryByText("Ayer fui al mercado")).not.toBeInTheDocument();
    expect(screen.getByTestId("orb")).toHaveClass("size-28", "motion-reduce:transition-none");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss phrase" }));
    expect(screen.queryByText("Anoche salí")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pretérito" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ir en pretérito" })).toBeInTheDocument();
    expect(screen.getByTestId("orb")).toHaveClass("size-44");
  });
});
