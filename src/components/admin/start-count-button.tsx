"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, postJson } from "@/lib/api-client";

/**
 * Starts a shelf count and goes straight to the scanning screen.
 *
 * Only one count can be open at a time, and the server is what enforces that —
 * this button only reports what it says.
 */
export function StartCountButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);

    try {
      const { id } = await postJson<{ id: string }>("/api/admin/stock-take", {
        action: "start",
      });

      router.push(`/admin/stock-take/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start a count.");
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <Button type="button" disabled={busy} onClick={() => void start()}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Start a count"}
      </Button>
      {error ? (
        <p role="alert" className="mt-1 max-w-xs text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
