import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ReviewCard, ReviewDeck } from "./review-deck";

const refresh = vi.fn();
const toastError = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { error: (msg: string) => toastError(msg) } }));

const card = (id: string, word: string, translation: string): ReviewCard => ({
  id,
  word,
  translation,
  example: null,
  ease: 2.5,
  intervalDays: 0,
  reps: 0,
});

const CARDS = [card("v1", "la cuenta", "the bill"), card("v2", "el andén", "the platform")];

const reviewCall = (id: string, grade: number) => [
  `/api/vocab/${id}/review`,
  expect.objectContaining({ method: "POST", body: JSON.stringify({ grade }) }),
];

describe("ReviewDeck", () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({}));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("reveals the answer, then posts the chosen grade and advances", async () => {
    render(<ReviewDeck cards={CARDS} nextDueLabel={null} />);
    expect(screen.queryByRole("button", { name: /^Good/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    expect(screen.getByText("the bill")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^Good/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(...reviewCall("v1", 2)));
    expect(screen.getByText("el andén")).toBeInTheDocument();
  });

  it("maps keys 1-4 to Again/Hard/Good/Easy once revealed", async () => {
    render(<ReviewDeck cards={CARDS} nextDueLabel={null} />);
    fireEvent.keyDown(window, { key: "4" });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "4" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(...reviewCall("v1", 3)));

    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "2" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(...reviewCall("v2", 1)));
  });

  it("leaves Enter, Space and digits to focused controls", () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <ReviewDeck cards={CARDS} nextDueLabel={null} />
      </>,
    );
    const other = screen.getByRole("button", { name: "Elsewhere" });
    other.focus();
    expect(fireEvent.keyDown(other, { key: "Enter" })).toBe(true);
    fireEvent.keyDown(other, { key: " " });
    expect(screen.queryByText("the bill")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(other, { key: "3" });
    fireEvent.keyDown(window, { key: "3", repeat: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("brings Again cards back and finishes with a summary", async () => {
    render(<ReviewDeck cards={[CARDS[0]]} nextDueLabel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Again/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(...reviewCall("v1", 0)));
    expect(screen.getByText("la cuenta")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Easy/ }));
    await waitFor(() => expect(screen.getByText("All caught up")).toBeInTheDocument());
    expect(refresh).toHaveBeenCalled();
  });

  it("requeues a card when saving the review fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    render(<ReviewDeck cards={[CARDS[0]]} nextDueLabel={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Good/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByText("la cuenta")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("shows a real empty state when nothing is due", () => {
    render(<ReviewDeck cards={[]} nextDueLabel="in 5 hr" />);
    expect(screen.getByText("Nothing due. Come back tomorrow.")).toBeInTheDocument();
    expect(screen.getByText(/Next word is due in 5 hr/)).toBeInTheDocument();
  });
});
