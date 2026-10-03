import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PhraseCard } from "./phrase-card";

afterEach(cleanup);

describe("PhraseCard", () => {
  it("renders nothing without a phrase", () => {
    const { container } = render(<PhraseCard phrase={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Spanish line large with the English below", () => {
    render(<PhraseCard phrase={{ id: "p1", spanish: "¿Me da dos tacos?", english: "Can I have two tacos?" }} />);
    const spanish = screen.getByText("¿Me da dos tacos?");
    expect(spanish).toHaveAttribute("lang", "es");
    expect(spanish).toHaveClass("font-display");
    expect(screen.getByText("Can I have two tacos?")).toBeInTheDocument();
  });

  it("only ever shows the latest phrase", () => {
    const { rerender } = render(<PhraseCard phrase={{ id: "p1", spanish: "Hola", english: "Hello" }} />);
    rerender(<PhraseCard phrase={{ id: "p2", spanish: "Mucho gusto", english: "Nice to meet you" }} />);
    expect(screen.queryByText("Hola")).not.toBeInTheDocument();
    expect(screen.getByText("Mucho gusto")).toBeInTheDocument();
    expect(screen.getAllByRole("figure")).toHaveLength(1);
  });
});
