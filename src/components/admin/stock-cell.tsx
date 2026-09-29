"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, requestJson } from "@/lib/api-client";

/**
 * Adjusting the stock on one size.
 *
 * Not an inline edit any more. Changing a count by hand now asks WHY, because
 * the number goes into a permanent ledger and "it was 4, now it is 3" with no
 * reason is exactly what that ledger exists to stop. Typing a new figure opens
 * a short form; saving without a reason is refused by the server too.
 */
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
  const [reason, setReason] = useState<"DAMAGE" | "ADJUSTMENT">("ADJUSTMENT");
  const [note, setNote] = useState("");
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

    if (note.trim().length < 3) {
      setError("Say what happened.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await requestJson("/api/admin/inventory", "PATCH", {
        variantId,
        stockQty: parsed,
        reason,
        note: note.trim(),
      });
      setNote("");
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
    <div className="flex flex-col items-end gap-2">
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
        />

        {!dirty && saved ? (
          <span className="flex items-center text-xs text-emerald-700 dark:text-emerald-500">
            <Check className="size-3.5" aria-hidden />
            Saved
          </span>
        ) : !dirty ? (
          <span className="w-14" />
        ) : null}
      </div>

      {/* Only once the figure has actually changed — nothing to explain until
          then, and a reason box on every row would be noise. */}
      {dirty ? (
        <div className="w-full max-w-xs space-y-2 rounded-md border bg-muted/40 p-2 text-left">
          <div className="space-y-1">
            <Label htmlFor={`reason-${variantId}`} className="text-xs">
              Why?
            </Label>
            <select
              id={`reason-${variantId}`}
              value={reason}
              onChange={(event) =>
                setReason(event.target.value === "DAMAGE" ? "DAMAGE" : "ADJUSTMENT")
              }
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="ADJUSTMENT">Correction — the count was wrong</option>
              <option value="DAMAGE">Damaged or written off</option>
            </select>
          </div>

          <Input
            value={note}
            placeholder="e.g. found one more on the top shelf"
            aria-label="Note"
            className="h-8 text-sm"
            onChange={(event) => {
              setNote(event.target.value);
              setError(null);
            }}
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                `Save ${Number(value) - stockQty > 0 ? "+" : ""}${Number(value) - stockQty}`
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              disabled={busy}
              onClick={() => {
                setValue(String(stockQty));
                setNote("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>

          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
