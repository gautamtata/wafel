import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const push = vi.fn();
const toastError = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { error: (msg: string) => toastError(msg) } }));

const respond = (status: number) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status }));

const submit = (passphrase: string) => {
  fireEvent.change(screen.getByLabelText("Passphrase"), {
    target: { value: passphrase },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enter" }));
};

describe("LoginForm", () => {
  beforeEach(() => render(<LoginForm next="/vocab" />));
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("posts the passphrase and navigates to next on success", async () => {
    const fetchMock = respond(204);
    submit("wafel");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/vocab"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ passphrase: "wafel" }),
      }),
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts on a wrong passphrase", async () => {
    respond(401);
    submit("nope");
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("That's not it."));
  });

  it("toasts when rate limited", async () => {
    respond(429);
    submit("nope");
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Too many tries. Wait a minute."),
    );
  });
});
