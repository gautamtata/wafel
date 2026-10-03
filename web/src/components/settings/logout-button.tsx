"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    const res = await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    if (res?.ok) {
      router.replace("/login");
      router.refresh();
      return;
    }
    toast.error("Couldn't sign out. Try again.");
    setPending(false);
  }

  return (
    <Button
      variant="outline"
      onClick={logout}
      disabled={pending}
      className="h-11 w-full rounded-xl text-base sm:w-auto sm:px-5"
    >
      <LogOut />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
