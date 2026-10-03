import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseNote } from "@/lib/session-live";
import { NoteCard } from "./note-card";

afterEach(cleanup);

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe("parseNote", () => {
  it("parses a wafel.note data message", () => {
    expect(parseNote(encode({ type: "note", title: "Ser vs estar", body: "Ser: identity." }))).toEqual({
      title: "Ser vs estar",
      body: "Ser: identity.",
    });
  });

  it("rejects malformed payloads", () => {
    expect(parseNote(encode({ type: "other", title: "x", body: "y" }))).toBeNull();
    expect(parseNote(encode({ type: "note", title: "x" }))).toBeNull();
    expect(parseNote(new TextEncoder().encode("not json"))).toBeNull();
  });
});

describe("NoteCard", () => {
  it("renders the note and dismisses", () => {
    const onDismiss = vi.fn();
    render(<NoteCard note={{ id: "n1", title: "Ser vs estar", body: "Ser: identity." }} onDismiss={onDismiss} />);
    expect(screen.getByRole("heading", { name: "Ser vs estar" })).toBeInTheDocument();
    expect(screen.getByText("Ser: identity.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith("n1");
  });
});
