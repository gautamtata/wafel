import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type LearnerSettings, SettingsForm } from "./settings-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "system", setTheme: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const INITIAL: LearnerSettings = {
  level: "A2",
  dialect: "MX",
  correctionMode: "SUBTLE",
  pace: "SLOW",
  voice: "marin",
  sessionCapMinutes: 15,
  nativeLanguage: "en",
  goals: "",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SettingsForm", () => {
  it("edits the Spanish variety and goals", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ id: "owner" }));
    render(<SettingsForm initial={INITIAL} />);

    const dialect = screen.getByLabelText("Spanish variety");
    expect(dialect).toHaveValue("MX");
    expect(screen.getByText(/ustedes, Mexican vocabulary/)).toBeInTheDocument();
    fireEvent.change(dialect, { target: { value: "ES" } });
    expect(screen.getByText(/vosotros/)).toBeInTheDocument();

    const goals = screen.getByLabelText("Goals");
    expect(goals).toHaveAttribute("placeholder", "e.g. talk with my Mexican friends in California");
    fireEvent.change(goals, { target: { value: "Chat with my in-laws" } });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/learner");
    expect(JSON.parse(String(init?.body))).toMatchObject({ dialect: "ES", goals: "Chat with my in-laws" });
  });
});
