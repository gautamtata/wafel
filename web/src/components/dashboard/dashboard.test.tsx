import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardView } from "@/lib/dashboard";
import { Dashboard } from "./dashboard";

vi.mock("./tutor-presence", () => ({ TutorPresence: () => <div data-testid="orb" /> }));

const NOW = new Date(2026, 9, 3, 15);

const VIEW: DashboardView = {
  level: "A2",
  streakDays: 3,
  minutesThisWeek: 42,
  wordsDue: 7,
  monthSpendCents: 340,
  unresolvedMistakes: 1,
  nextSuggestion: {
    type: "LESSON",
    topic: "Making plans and invitations",
    reason: "Next on your A2 path.",
  },
  recentSessions: [
    {
      id: "abc",
      type: "LESSON",
      status: "RECAP_READY",
      topic: "Describing your home",
      scenarioTitle: null,
      startedAt: new Date(2026, 9, 3, 9),
      endedAt: new Date(2026, 9, 3, 9, 12),
      durationSec: 720,
      estimatedCostCents: 60,
    },
    {
      id: "def",
      type: "ROLEPLAY",
      status: "ENDED",
      topic: null,
      scenarioTitle: "Shopping at the market",
      startedAt: new Date(2026, 9, 2, 19),
      endedAt: new Date(2026, 9, 2, 19, 8),
      durationSec: 480,
      estimatedCostCents: 40,
    },
  ],
};

const tile = (label: string) => screen.getByText(label).closest("[data-slot=stat]") as HTMLElement;

afterEach(cleanup);

describe("Dashboard", () => {
  it("renders the four stats", () => {
    render(<Dashboard view={VIEW} now={NOW} />);
    expect(within(tile("Streak")).getByText("3")).toBeInTheDocument();
    expect(within(tile("This week")).getByText("42")).toBeInTheDocument();
    expect(within(tile("Words due")).getByText("7")).toBeInTheDocument();
    expect(within(tile("This month")).getByText("$3.40")).toBeInTheDocument();
  });

  it("shows today's suggestion with a start link", () => {
    render(<Dashboard view={VIEW} now={NOW} />);
    expect(screen.getByRole("heading", { name: "Making plans and invitations" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start lesson/ })).toHaveAttribute(
      "href",
      "/practice?type=LESSON&topic=Making+plans+and+invitations",
    );
  });

  it("links recent sessions to their recap or session page", () => {
    render(<Dashboard view={VIEW} now={NOW} />);
    const home = screen.getByRole("link", { name: /Describing your home/ });
    expect(home).toHaveAttribute("href", "/session/abc/recap");
    expect(within(home).getByText(/12 min/)).toBeInTheDocument();
    expect(within(home).getByText(/\$0\.60/)).toBeInTheDocument();
    const market = screen.getByRole("link", { name: /Shopping at the market/ });
    expect(market).toHaveAttribute("href", "/session/def/recap");
    expect(within(market).getByText("Recap pending")).toBeInTheDocument();
  });

  it("shows a first-run empty state", () => {
    render(
      <Dashboard
        view={{ ...VIEW, streakDays: 0, minutesThisWeek: 0, recentSessions: [] }}
        now={NOW}
      />,
    );
    expect(screen.getByText(/Your sessions will collect here/)).toBeInTheDocument();
  });
});
