import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Language } from "@/generated/prisma/client";
import { LEVEL_DESCRIPTORS } from "@/lib/prompts-meta";
import { LevelStep } from "./level-step";
import { OnboardingFlow } from "./onboarding-flow";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const LANGUAGES: Language[] = [
  { code: "es", name: "Spanish", nativeName: "Español", voice: "marin", enabled: true },
  { code: "fr", name: "French", nativeName: "Français", voice: "marin", enabled: false },
];

const heading = () => screen.getByRole("heading", { level: 1 }).textContent;
const next = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));
const back = () => fireEvent.click(screen.getByRole("button", { name: "Back" }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  replace.mockClear();
});

describe("LevelStep", () => {
  it("renders one card per CEFR level", () => {
    render(<LevelStep value={null} onChange={() => {}} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(6);
    for (const { title } of Object.values(LEVEL_DESCRIPTORS)) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it("reports the chosen level", () => {
    const onChange = vi.fn();
    render(<LevelStep value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Intermediate/ }));
    expect(onChange).toHaveBeenCalledWith("B1");
  });
});

describe("OnboardingFlow", () => {
  it("walks forward and back through the four steps", () => {
    render(<OnboardingFlow languages={LANGUAGES} />);
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /French/ })).toBeDisabled();
    const first = heading();

    next();
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(heading()).not.toBe(first);

    back();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(heading()).toBe(first);
  });

  it("requires a level before continuing", () => {
    render(<OnboardingFlow languages={LANGUAGES} />);
    next();
    next();
    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Elementary/ }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("saves the learner and goes home on finish", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ id: "owner" }));
    render(<OnboardingFlow languages={LANGUAGES} />);
    next();
    fireEvent.change(screen.getByLabelText(/What's it for/), {
      target: { value: "Trips to Oaxaca" },
    });
    next();
    fireEvent.click(screen.getByRole("radio", { name: /Elementary/ }));
    next();
    expect(screen.getByText("Step 4 of 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Explicit/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start learning" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/learner");
    expect(init?.method).toBe("PUT");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      targetLanguage: "es",
      nativeLanguage: "en",
      level: "A2",
      voice: "marin",
      correctionMode: "EXPLICIT",
      pace: "SLOW",
      goals: "Trips to Oaxaca",
    });
    expect(Number.isNaN(Date.parse(body.onboardedAt))).toBe(false);
  });
});
