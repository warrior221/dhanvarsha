"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for the catalog (spec 1.9). The real error is logged; the
 * shopper only sees a safe message and a way to retry.
 */
export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[products] Failed to render catalog:", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <ErrorState
        title="We could not load the shop"
        description="Something went wrong on our side. Please try again in a moment."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </main>
  );
}
