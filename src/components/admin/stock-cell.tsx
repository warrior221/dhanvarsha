"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, requestJson } from "@/lib/api-client";

/** Inline stock correction for one size. */
export function StockCell({
  variantId,
  stockQty,
  label,
}: {
  variantId: string;
  stockQty: number;
  label: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(stockQty));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== String(stockQty);

  async function save() {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Whole numbers only.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await requestJson("/api/admin/inventory", "PATCH", {
        variantId,
        stockQty: parsed,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Input
        value={value}
        inputMode="numeric"
        aria-label={`Stock for ${label}`}
        className="h-8 w-20 text-right tabular-nums"
        onChange={(event) => {
          setValue(event.target.value.replace(/\D/g, ""));
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (dirty) void save();
          }
        }}
      />

      {dirty ? (
        <Button type="button" size="sm" className="h-8" disabled={busy} onClick={() => void save()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "Save"}
        </Button>
      ) : saved ? (
        <span className="flex items-center text-xs text-emerald-700 dark:text-emerald-500">
          <Check className="size-3.5" aria-hidden />
          Saved
        </span>
      ) : (
        <span className="w-14" />
      )}

      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
