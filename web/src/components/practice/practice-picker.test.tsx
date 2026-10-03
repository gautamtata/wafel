import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PracticePicker } from "./practice-picker";
import type { UnitOption } from "./unit-picker";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const fetchMock = vi.fn<typeof fetch>(async () =>
  Response.json({ sessionId: "s1", token: "jwt", url: "wss://lk.test" }),
);

const units: UnitOption[] = [
  { id: "es-MX-A1-01", order: 1, title: "Hello, I'm…", canDo: "I can greet people.", status: "MASTERED" },
  { id: "es-MX-A1-02", order: 2, title: "At the taquería", canDo: "I can order tacos.", status: "IN_PROGRESS" },
  { id: "es-MX-A1-03", order: 3, title: "My family", canDo: "I can describe my family.", status: "NOT_STARTED" },
];

const scenarios = [{ id: "es-carne-asada", title: "A carne asada", description: "Backyard.", minLevel: "A1" as const }];

const renderPicker = (initialType: string | null = "LESSON", initialUnitId = "es-MX-A1-02") =>
  render(
    <PracticePicker
      context={{ level: "A1", unresolvedMistakes: 0 }}
      units={units}
      currentUnitId="es-MX-A1-02"
      initialUnitId={initialUnitId}
      scenarios={scenarios}
      initialType={initialType}
    />,
  );

const startAndReadBody = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  return JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as unknown;
};

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  push.mockClear();
});

describe("PracticePicker units", () => {
  it("shows the current unit and starts a lesson on it", async () => {
    renderPicker();
    expect(screen.getByText("Up next ·")).toBeInTheDocument();
    expect(screen.getByText("At the taquería")).toBeInTheDocument();
    expect(screen.getByText("I can order tacos.")).toBeInTheDocument();
    expect(await startAndReadBody()).toEqual({ type: "LESSON", unitId: "es-MX-A1-02" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/session/s1"));
  });

  it("lets the learner choose a different unit, showing each unit's status", async () => {
    renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Choose a different unit" }));
    const list = screen.getByRole("radiogroup", { name: "Unit" });
    expect(within(list).getByRole("radio", { name: /Hello, I'm…/ })).toHaveTextContent("Mastered");
    expect(within(list).getByRole("radio", { name: /At the taquería/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(list).getByRole("radio", { name: /My family/ }));
    expect(screen.getByText("Unit 3 ·")).toBeInTheDocument();
    expect(await startAndReadBody()).toEqual({ type: "LESSON", unitId: "es-MX-A1-03" });
  });

  it("honours a requested unit", async () => {
    renderPicker("LESSON", "es-MX-A1-03");
    expect(screen.getByText("Unit 3 ·")).toBeInTheDocument();
    expect(screen.getByText("I can describe my family.")).toBeInTheDocument();
    expect(await startAndReadBody()).toEqual({ type: "LESSON", unitId: "es-MX-A1-03" });
  });

  it("shows the unit shadowing will use and sends it", async () => {
    renderPicker("SHADOWING");
    expect(screen.getByText("At the taquería")).toBeInTheDocument();
    expect(await startAndReadBody()).toEqual({ type: "SHADOWING", unitId: "es-MX-A1-02" });
  });

  it("sends the scenario for role-plays", async () => {
    renderPicker("ROLEPLAY");
    expect(await startAndReadBody()).toEqual({ type: "ROLEPLAY", scenarioId: "es-carne-asada" });
  });
});
