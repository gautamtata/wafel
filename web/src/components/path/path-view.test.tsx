import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cefr, UnitStatus } from "@/generated/prisma/enums";
import { type PathLevel, PathView } from "./path-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const fetchMock = vi.fn<typeof fetch>(async () =>
  Response.json({ sessionId: "s1", token: "jwt", url: "wss://lk.test" }),
);

const unit = (level: Cefr, order: number, title: string, status: UnitStatus, isCurrent = false) => ({
  id: `es-MX-${level}-0${order}`,
  level,
  order,
  title,
  canDo: `I can talk about ${title.toLowerCase()}.`,
  status,
  masteredWords: status === "MASTERED" ? 11 : status === "IN_PROGRESS" ? 4 : 0,
  totalWords: 12,
  isCurrent,
  pattern: {
    name: `Pattern ${level}-${order}`,
    explanationEn: `How pattern ${order} works.`,
    examples: [
      { es: `Ejemplo ${level}-${order}`, en: `Example ${level}-${order}` },
      { es: "Otro ejemplo", en: "Another example" },
    ],
  },
});

const LEVELS: PathLevel[] = [
  { level: "A1", units: [unit("A1", 1, "Greetings", "MASTERED")] },
  {
    level: "A2",
    units: [
      unit("A2", 1, "Last weekend", "IN_PROGRESS"),
      unit("A2", 2, "When I was a kid", "NOT_STARTED", true),
    ],
  },
  { level: "B1", units: [unit("B1", 1, "Stories", "NOT_STARTED")] },
];

const card = (title: string) => screen.getByText(title).closest("[data-slot=unit-card]") as HTMLElement;

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  push.mockClear();
});

describe("PathView", () => {
  it("groups units by level and collapses levels above the learner's", () => {
    render(<PathView learnerLevel="A2" levels={LEVELS} />);
    for (const level of ["A1", "A2", "B1"]) {
      expect(screen.getByRole("heading", { name: new RegExp(`^${level}`) })).toBeInTheDocument();
    }
    expect(screen.getByText("Greetings")).toBeInTheDocument();
    expect(screen.queryByText("Stories")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show B1 units/ }));
    expect(screen.getByText("Stories")).toBeInTheDocument();
  });

  it("opens the current unit's level even above the learner's level", () => {
    const raised: PathLevel[] = [
      { level: "A2", units: [unit("A2", 1, "Last weekend", "MASTERED")] },
      { level: "B1", units: [unit("B1", 1, "Stories", "NOT_STARTED", true)] },
    ];
    render(<PathView learnerLevel="A2" levels={raised} />);
    expect(screen.getByRole("button", { name: /Hide B1 units/ })).toHaveAttribute("aria-expanded", "true");
    expect(card("Stories")).toHaveAttribute("data-current", "true");
  });

  it("shows status badges and progress per unit", () => {
    render(<PathView learnerLevel="A2" levels={LEVELS} />);
    expect(within(card("Greetings")).getByText("Mastered")).toBeInTheDocument();
    expect(within(card("Last weekend")).getByText("In progress")).toBeInTheDocument();
    expect(within(card("When I was a kid")).getByText("Not started")).toBeInTheDocument();
    expect(within(card("Last weekend")).getByRole("img", { name: "4 of 12 words mastered" })).toBeInTheDocument();
  });

  it("highlights the current unit with its grammar note open", () => {
    render(<PathView learnerLevel="A2" levels={LEVELS} />);
    const current = card("When I was a kid");
    expect(current).toHaveAttribute("data-current", "true");
    expect(within(current).getByText("Up next")).toBeInTheDocument();
    expect(within(current).getByText("Pattern A2-2")).toBeInTheDocument();
    expect(card("Last weekend")).not.toHaveAttribute("data-current");
  });

  it("toggles a unit's grammar note, one open at a time", () => {
    render(<PathView learnerLevel="A2" levels={LEVELS} />);
    const toggle = within(card("Last weekend")).getByRole("button", { name: /Last weekend/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("How pattern 1 works.")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const note = within(card("Last weekend"));
    expect(note.getByText("Grammar note")).toBeInTheDocument();
    expect(note.getByRole("heading", { level: 3, name: "Pattern A2-1" })).toBeInTheDocument();
    expect(note.getByText("Grammar note").closest("[id^=unit-]")).toHaveClass("motion-reduce:animate-none");
    expect(note.getByText("How pattern 1 works.")).toBeInTheDocument();
    expect(note.getByText("Ejemplo A2-1")).toBeInTheDocument();
    expect(note.getByText("Example A2-1")).toBeInTheDocument();
    expect(screen.queryByText("Pattern A2-2")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByText("How pattern 1 works.")).not.toBeInTheDocument();
  });

  it("starts a lesson on the chosen unit", async () => {
    render(<PathView learnerLevel="A2" levels={LEVELS} />);
    fireEvent.click(within(card("Last weekend")).getByRole("button", { name: /Last weekend/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start this unit" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/session/s1"));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      type: "LESSON",
      unitId: "es-MX-A2-01",
    });
  });
});
