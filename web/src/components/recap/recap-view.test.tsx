import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionView } from "@/lib/sessions";
import type { Recap, RecapUnit } from "@/lib/types";
import { RecapView } from "./recap-view";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

afterEach(cleanup);

const NOW = new Date(2026, 9, 3, 18);

const SESSION: SessionView = {
  id: "s1",
  type: "LESSON",
  status: "RECAP_READY",
  topic: "Last weekend",
  scenarioTitle: null,
  startedAt: new Date(2026, 9, 3, 17),
  endedAt: new Date(2026, 9, 3, 17, 10),
  durationSec: 600,
  estimatedCostCents: 50,
  capMinutes: 15,
  knownLines: [],
  recap: null,
  transcript: null,
};

const OLD_RECAP: Recap = {
  summary: "Hablaste de tu fin de semana.",
  levelNote: "Comfortable A2.",
  memory: "Visited grandmother.",
  mistakes: [
    { original: "ayer visito", corrected: "ayer visité", explanation: "Preterite.", category: "CONJUGATION" },
  ],
  newVocab: [],
};

const UNIT: RecapUnit = {
  id: "es-MX-A2-01",
  title: "Last weekend",
  status: "IN_PROGRESS",
  wordsRated: [
    { word: "ayer", best: 3 },
    { word: "anoche", best: 1 },
  ],
  patternScore: 2,
  masteredWords: 5,
  totalWords: 13,
  nextStep: { unitId: "es-MX-A2-01", title: "Last weekend", raiseLevelSuggested: false },
};

const renderRecap = (recap: Recap) => render(<RecapView session={SESSION} recap={recap} words={[]} now={NOW} />);

const unitSection = () => screen.getByRole("region", { name: "This unit" });

describe("RecapView unit section", () => {
  it("shows unit progress, rated words with best-so-far pips and the next step", () => {
    renderRecap({ ...OLD_RECAP, nextStep: "Contrast visité with visitaba next time.", unit: UNIT });
    const section = within(unitSection());
    expect(section.getByText("Last weekend")).toBeInTheDocument();
    expect(section.getByText("In progress")).toBeInTheDocument();
    expect(section.getByText("5 of 13 words mastered")).toBeInTheDocument();
    expect(section.getByText("Best so far")).toBeInTheDocument();
    expect(section.getByRole("img", { name: "ayer, best so far: 3 of 3" })).toBeInTheDocument();
    expect(section.getByRole("img", { name: "anoche, best so far: 1 of 3" })).toBeInTheDocument();
    expect(section.getByRole("img", { name: "Grammar pattern: 2 of 3" })).toBeInTheDocument();
    expect(section.getByText(/Keep going with Last weekend/)).toBeInTheDocument();
    expect(screen.getByText("Contrast visité with visitaba next time.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Practice these mistakes/ })).toBeInTheDocument();
  });

  it("names the next unit and suggests moving up a level", () => {
    renderRecap({
      ...OLD_RECAP,
      unit: {
        ...UNIT,
        status: "MASTERED",
        nextStep: { unitId: "es-MX-B1-01", title: "Stories from the past", raiseLevelSuggested: true },
      },
    });
    const section = within(unitSection());
    expect(section.getByText("Mastered")).toBeInTheDocument();
    expect(section.getByText(/Next up: Stories from the past/)).toBeInTheDocument();
    expect(section.getByText(/Consider moving up to B1/)).toBeInTheDocument();
  });

  it("says when no words were rated and when the path is finished", () => {
    renderRecap({
      ...OLD_RECAP,
      unit: { ...UNIT, wordsRated: [], nextStep: { unitId: null, title: null, raiseLevelSuggested: false } },
    });
    const section = within(unitSection());
    expect(section.getByText("No words were rated this time.")).toBeInTheDocument();
    expect(section.getByText(/finished every unit on your path/)).toBeInTheDocument();
    expect(section.queryByText(/Next up/)).not.toBeInTheDocument();
  });

  it("renders an old recap without a unit or next step as before", () => {
    renderRecap(OLD_RECAP);
    expect(screen.queryByRole("region", { name: "This unit" })).not.toBeInTheDocument();
    expect(screen.getByText("Hablaste de tu fin de semana.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Corrections/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Practice these mistakes/ })).toBeInTheDocument();
  });
});
