"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, requestJson } from "@/lib/api-client";

/**
 * Per-row admin actions.
 *
 * Deleting is refused server-side for anything that appears on a past order,
 * and the refusal is surfaced verbatim so the admin is told to hide it instead.
 */
export function ProductRowActions({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive() {
    setBusy(true);
    setError(null);

    try {
      await requestJson(`/api/admin/products/${id}`, "PATCH", { isActive: !isActive });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update that.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${name}" permanently? This cannot be undone.`)) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await requestJson(`/api/admin/products/${id}`, "DELETE");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/products/${id}/edit`}>Edit</Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void toggleActive()}
        >
          {isActive ? "Hide" : "Show"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => void remove()}
        >
          Delete
        </Button>
      </div>

      {error ? (
        <p role="alert" className="max-w-xs text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
