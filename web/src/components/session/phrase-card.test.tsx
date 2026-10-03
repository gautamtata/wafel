import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhraseCard } from "./phrase-card";

afterEach(cleanup);

const noop = () => {};

describe("PhraseCard", () => {
  it("keeps an empty live region without a phrase", () => {
    const { container } = render(<PhraseCard phrase={null} onDismiss={noop} />);
    expect(container.firstChild).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });

  it("shows the Spanish line large with the English below, without motion when reduced", () => {
    render(
      <PhraseCard phrase={{ id: "p1", spanish: "¿Me da dos tacos?", english: "Can I have two tacos?" }} onDismiss={noop} />,
    );
    const spanish = screen.getByText("¿Me da dos tacos?");
    expect(spanish).toHaveAttribute("lang", "es");
    expect(spanish).toHaveClass("font-display");
    expect(screen.getByText("Can I have two tacos?")).toBeInTheDocument();
    expect(screen.getByRole("figure")).toHaveClass("animate-in", "motion-reduce:animate-none");
  });

  it("only ever shows the latest phrase, inside the same live region", () => {
    const { container, rerender } = render(<PhraseCard phrase={{ id: "p1", spanish: "Hola", english: "Hello" }} onDismiss={noop} />);
    const region = container.firstChild;
    rerender(<PhraseCard phrase={{ id: "p2", spanish: "Mucho gusto", english: "Nice to meet you" }} onDismiss={noop} />);
    expect(container.firstChild).toBe(region);
    expect(screen.queryByText("Hola")).not.toBeInTheDocument();
    expect(screen.getByText("Mucho gusto")).toBeInTheDocument();
    expect(screen.getAllByRole("figure")).toHaveLength(1);
  });

  it("dismisses with a 44px button", () => {
    const onDismiss = vi.fn();
    render(<PhraseCard phrase={{ id: "p1", spanish: "Hola", english: "Hello" }} onDismiss={onDismiss} />);
    const button = screen.getByRole("button", { name: "Dismiss phrase" });
    expect(button).toHaveClass("size-11");
    fireEvent.click(button);
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
