import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VocabPicks } from "./vocab-picks";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (msg: string) => toastError(msg) } }));

const WORD = { word: "la cuenta", translation: "the bill", example: "¿Me trae la cuenta?" };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("VocabPicks", () => {
  it("removes a word from the deck, then adds it back", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ id: "v9" }, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<VocabPicks sessionId="s1" words={[{ ...WORD, id: "v1" }]} />);

    const toggle = screen.getByRole("switch", { name: /In deck/ });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/vocab/v1", expect.objectContaining({ method: "DELETE" })),
    );
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/vocab",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ ...WORD, sourceSessionId: "s1" }),
        }),
      ),
    );
    await waitFor(() => expect(toggle).not.toHaveAttribute("aria-disabled"));

    fireEvent.click(toggle);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/vocab/v9", expect.objectContaining({ method: "DELETE" })),
    );
  });

  it("reverts the toggle when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    render(<VocabPicks sessionId="s1" words={[{ ...WORD, id: "v1" }]} />);
    const toggle = screen.getByRole("switch", { name: /In deck/ });
    fireEvent.click(toggle);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});
