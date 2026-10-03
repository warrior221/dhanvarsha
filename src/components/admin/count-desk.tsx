"use client";

import { AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, postJson } from "@/lib/api-client";
import type { CountScanResult, StocktakeLineView } from "@/lib/queries/stocktake";

/**
 * Scanning the shelves.
 *
 * Nothing here changes stock. A count only records what was found; the
 * corrections come later, one at a time, after the owner has read the report.
 *
 * Every saree of one design carries the same tag, so three of them means
 * scanning that tag three times — the number beside the piece is how many have
 * been counted, and the box takes focus back after each scan.
 */
export function CountDesk({
  stocktakeId,
  initialLines,
  progress,
}: {
  stocktakeId: string;
  initialLines: StocktakeLineView[];
  progress: { countedPieces: number; expectedPieces: number };
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [last, setLast] = useState<CountScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function scan() {
    const barcode = code.trim();
    if (barcode === "" || busy) return;

    setBusy(true);
    setError(null);

    try {
      const result = await postJson<CountScanResult>("/api/admin/stock-take", {
        action: "scan",
        stocktakeId,
        barcode,
      });

      setLast(result);
      router.refresh();
    } catch (err) {
      setLast(null);
      setError(err instanceof ApiError ? err.message : "Could not record that scan.");
    } finally {
      setCode("");
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function finish() {
    setFinishing(true);
    setError(null);

    try {
      await postJson("/api/admin/stock-take", { action: "finish", stocktakeId });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not finish the count.");
      setFinishing(false);
    }
  }

  async function abandon() {
    if (!window.confirm("Give up on this count? Nothing will be changed.")) return;

    try {
      await postJson("/api/admin/stock-take", { action: "abandon", stocktakeId });
      router.push("/admin/stock-take");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not abandon the count.");
    }
  }

  const remaining = progress.expectedPieces - progress.countedPieces;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-4">
        <div className="rounded-lg border bg-background p-5">
          <label htmlFor="count-scan" className="text-sm font-medium">
            Scan each piece on the shelf
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id="count-scan"
              ref={inputRef}
              value={code}
              autoComplete="off"
              spellCheck={false}
              placeholder="Scan, or type the code and press Enter"
              className="h-12 flex-1 font-mono text-lg"
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void scan();
                }
              }}
            />
            <Button
              type="button"
              size="lg"
              disabled={busy || code.trim() === ""}
              onClick={() => void scan()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Count"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Scan the same tag once for every piece of it you find. Nothing
            changes stock yet — you decide that after the count.
          </p>
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertTriangle className="size-4" aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {last ? (
          <div
            className={
              last.unknownTag
                ? "flex items-center gap-3 rounded-lg border-2 border-amber-500/50 bg-amber-50/60 p-4 dark:bg-amber-950/20"
                : "flex items-center gap-3 rounded-lg border-2 border-emerald-600/40 bg-emerald-50/50 p-4 dark:bg-emerald-950/20"
            }
          >
            {last.unknownTag ? (
              <HelpCircle className="size-5 shrink-0 text-amber-700" aria-hidden />
            ) : null}

            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {last.productName}
                              </p>
              <p className="text-sm text-muted-foreground">
                {last.unknownTag
                  ? "This tag belongs to nothing in the system. It is recorded so you can look at it later."
                  : `Counted ${last.countedQty} of this piece so far`}
              </p>
            </div>

            <p className="shrink-0 text-2xl font-semibold tabular-nums">
              {last.countedQty}
            </p>
          </div>
        ) : null}

        <div className="rounded-lg border bg-background p-5">
          <h2 className="mb-1 text-sm font-medium">Finishing</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            A count covers the whole shop. Anything you have not scanned will be
            reported as missing, so finish only once you have walked every shelf.
            {remaining > 0
              ? ` The system expects ${progress.expectedPieces} pieces and you have counted ${progress.countedPieces} — ${remaining} still unaccounted for.`
              : " You have counted everything the system expects, and more is fine."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={finishing} onClick={() => void finish()}>
              {finishing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                "Finish counting"
              )}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void abandon()}>
              Give up
            </Button>
          </div>
        </div>
      </div>

      <aside className="rounded-lg border bg-background p-5">
        <h2 className="text-lg font-medium">
          Counted so far — {progress.countedPieces}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {initialLines.length} {initialLines.length === 1 ? "piece" : "pieces"} of
          stock touched
        </p>

        {initialLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scanned yet.</p>
        ) : (
          <ul className="divide-y">
            {initialLines.map((line) => (
              <CountLineRow key={line.lineId} line={line} onError={setError} />
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

/**
 * One counted piece, with the number open to correction.
 *
 * A tag scanned once too many times is the commonest mistake on a shelf count,
 * and the fix has to be here rather than in the report — while the piece is
 * still in hand and can be looked at again.
 */
function CountLineRow({
  line,
  onError,
}: {
  line: StocktakeLineView;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(line.countedQty));
  const [saving, setSaving] = useState(false);

  async function save() {
    const countedQty = Number(value);

    if (!Number.isInteger(countedQty) || countedQty < 0) {
      setValue(String(line.countedQty));
      return;
    }

    if (countedQty === line.countedQty) return;

    setSaving(true);

    try {
      await postJson("/api/admin/stock-take", {
        action: "setCount",
        lineId: line.lineId,
        countedQty,
      });
      router.refresh();
    } catch (err) {
      setValue(String(line.countedQty));
      onError(err instanceof ApiError ? err.message : "Could not change that count.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex items-center gap-2 py-2">
      <span className="min-w-0 flex-1 text-sm">
        {line.productName}
                {line.variantId === null ? (
          <span className="block font-mono text-xs text-amber-700 dark:text-amber-500">
            {line.scannedCode} — unknown
          </span>
        ) : null}
      </span>

      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        disabled={saving}
        aria-label={`Pieces of ${line.productName} found`}
        className="h-8 w-16 shrink-0 text-center tabular-nums"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void save();
          }
        }}
      />
    </li>
  );
}
