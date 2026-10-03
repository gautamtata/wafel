import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PracticePicker } from "./practice-picker";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const fetchMock = vi.fn<typeof fetch>(async () =>
  Response.json({ sessionId: "s1", token: "jwt", url: "wss://lk.test" }),
);

const topics = [
  { topic: "Greetings and introductions", covered: true },
  { topic: "Numbers, prices and time", covered: false },
  { topic: "Ordering food and drink", covered: false },
];

const renderPicker = (initialType: string | null = "LESSON") =>
  render(
    <PracticePicker
      context={{ level: "A1", unresolvedMistakes: 0 }}
      topics={topics}
      suggestedTopic="Numbers, prices and time"
      scenarios={[]}
      initialType={initialType}
    />,
  );

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  push.mockClear();
});

describe("PracticePicker topics", () => {
  it("shows the suggested topic and starts a lesson with it", async () => {
    renderPicker();
    expect(screen.getByText("Numbers, prices and time")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/session/s1"));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      type: "LESSON",
      topic: "Numbers, prices and time",
    });
  });

  it("lets the learner pick another topic, marking covered ones", async () => {
    renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Choose a different topic" }));
    const covered = screen.getByRole("radio", { name: /Greetings and introductions/ });
    expect(covered).toContainElement(screen.getByLabelText("Covered"));
    fireEvent.click(screen.getByRole("radio", { name: "Ordering food and drink" }));
    expect(screen.getByText("Topic ·")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      topic: "Ordering food and drink",
    });
  });

  it("sends no topic for other types", async () => {
    renderPicker("SHADOWING");
    fireEvent.click(screen.getByRole("button", { name: "Start lesson" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ type: "SHADOWING" });
  });
});
