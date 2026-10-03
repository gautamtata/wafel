import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { groupMistakes } from "@/lib/mistake-categories";
import { MistakeGroup } from "./mistake-group";

const refresh = vi.fn();
const toastError = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { error: (msg: string) => toastError(msg) } }));

const [GROUP] = groupMistakes([
  { id: "m1", category: "CONJUGATION", resolved: false, original: "yo tieno", corrected: "yo tengo", explanation: "Tener is irregular." },
  { id: "m2", category: "CONJUGATION", resolved: true, original: "él hació", corrected: "él hizo", explanation: "Hacer is irregular in the preterite." },
]);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("MistakeGroup", () => {
  it("shows the category with its open count and each correction", () => {
    render(<MistakeGroup group={GROUP} />);
    const heading = screen.getByRole("heading", { name: /Conjugation/ });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText("1 open")).toBeInTheDocument();
    expect(screen.getByText("yo tieno").tagName).toBe("DEL");
    expect(screen.getByText("Hacer is irregular in the preterite.")).toBeInTheDocument();
  });

  it("resolves optimistically and patches the mistake", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
    render(<MistakeGroup group={GROUP} />);
    const row = screen.getByText("yo tieno").closest("li") as HTMLElement;
    const toggle = within(row).getByRole("switch", { name: /Resolved/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("All resolved")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/mistakes/m1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ resolved: true }) }),
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("rolls back when the patch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    render(<MistakeGroup group={GROUP} />);
    const row = screen.getByText("él hació").closest("li") as HTMLElement;
    const toggle = within(row).getByRole("switch", { name: /Resolved/ });
    fireEvent.click(toggle);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});
