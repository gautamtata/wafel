import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MistakeList } from "./mistake-list";

afterEach(cleanup);

describe("MistakeList", () => {
  it("strikes through the original and shows the correction", () => {
    render(
      <MistakeList
        mistakes={[
          {
            original: "yo soy cansado",
            corrected: "yo estoy cansado",
            explanation: "Use estar for temporary states.",
            category: "GRAMMAR",
          },
        ]}
      />,
    );
    const original = screen.getByText("yo soy cansado");
    expect(original.tagName).toBe("DEL");
    expect(original).toHaveClass("line-through", "text-muted-foreground");
    const corrected = screen.getByText("yo estoy cansado");
    expect(corrected.tagName).toBe("INS");
    expect(corrected).toHaveClass("text-foreground");
    expect(screen.getByText("Use estar for temporary states.")).toBeInTheDocument();
    expect(screen.getByText("Grammar")).toBeInTheDocument();
  });

  it("celebrates a clean session", () => {
    render(<MistakeList mistakes={[]} />);
    expect(screen.getByText(/No corrections this time/)).toBeInTheDocument();
  });
});
