import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Turn } from "@/lib/session-live";
import { TranscriptFeed } from "./transcript-feed";

afterEach(cleanup);

const turn = (i: number, role: Turn["role"]): Turn => ({
  id: `s${i}`,
  role,
  text: `${role} line ${i}`,
  at: i,
  final: true,
});

describe("TranscriptFeed", () => {
  it("renders tutor and learner turns with their roles", () => {
    render(<TranscriptFeed turns={[turn(1, "tutor"), turn(2, "learner")]} />);
    const tutor = screen.getByText("tutor line 1").closest("[data-role]");
    const learner = screen.getByText("learner line 2").closest("[data-role]");
    expect(tutor).toHaveAttribute("data-role", "tutor");
    expect(learner).toHaveAttribute("data-role", "learner");
  });

  it("shows the last six turns and expands on request", () => {
    const turns = Array.from({ length: 9 }, (_, i) => turn(i, i % 2 ? "learner" : "tutor"));
    render(<TranscriptFeed turns={turns} />);
    expect(screen.queryByText("tutor line 2")).not.toBeInTheDocument();
    expect(screen.getByText("learner line 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show all/i }));
    expect(screen.getByText("tutor line 0")).toBeInTheDocument();
  });

  it("invites the learner to speak when empty", () => {
    render(<TranscriptFeed turns={[]} />);
    expect(screen.getByText(/your tutor is on the way|say hola/i)).toBeInTheDocument();
  });
});
