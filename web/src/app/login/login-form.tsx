"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERRORS: Record<number, string> = {
  401: "That's not it.",
  429: "Too many tries. Wait a minute.",
};

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const passphrase = String(new FormData(form).get("passphrase") ?? "");
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (res.ok) {
        router.push(next);
        return;
      }
      toast.error(ERRORS[res.status] ?? "Something went wrong. Try again.");
    } catch {
      toast.error("Can't reach Wafel. Check your connection.");
    }
    setPending(false);
    form.querySelector("input")?.select();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Label htmlFor="passphrase" className="sr-only">
        Passphrase
      </Label>
      <Input
        id="passphrase"
        name="passphrase"
        type="password"
        autoComplete="current-password"
        placeholder="Passphrase"
        autoFocus
        required
        className="h-12 rounded-xl bg-background/60 px-4 text-base md:text-base"
      />
      <Button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl text-base font-semibold shadow-[0_8px_24px_-12px_var(--honey)]"
      >
        {pending ? "Opening…" : "Enter"}
      </Button>
    </form>
  );
}
