"use client";

import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, postJson } from "@/lib/api-client";
import type { StocktakeLineView, StocktakeReport } from "@/lib/queries/stocktake";

/**
 * The report, and the corrections that come from it.
 *
 * NOTHING WAS APPLIED BY COUNTING. Every change on this screen is a deliberate
 * press, one piece at a time, and each one becomes an ordinary STOCKTAKE
 * movement in the same ledger as every sale and delivery.
 *
 * A line whose stock has moved since the count is not correctable: the figure
 * would undo whatever happened in between. The server refuses it and the row
 * says so.
 */

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export function StocktakeReportView({ report }: { report: StocktakeReport }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const { stocktake } = report;
  const done = stocktake.status === "CLOSED" || stocktake.status === "ABANDONED";

  async function close() {
    setClosing(true);
    setError(null);

    try {
      await postJson("/api/admin/stock-take", { action: "close", stocktakeId: stocktake.id });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not close the count.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg border bg-background p-5 text-sm">
        <Figure label="Counted" value={stocktake.countedPieces} />
        <Figure label="Missing" value={report.missing.length} tone={report.missing.length > 0 ? "warn" : undefined} />
        <Figure label="Extra" value={report.extra.length} />
        <Figure label="Unknown tags" value={report.unknown.length} />
        <Figure label="Agreed" value={report.agreedLines} />
        <div className="ml-auto text-right text-muted-foreground">
          <p>Counted {stocktake.countedAt ? DATE.format(new Date(stocktake.countedAt)) : "—"}</p>
          {stocktake.startedBy ? <p>by {stocktake.startedBy}</p> : null}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTriangle className="size-4" aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {stocktake.status === "ABANDONED" ? (
        <Alert>
          <AlertDescription>
            This count was given up on. Nothing was changed, and nothing can be
            changed from it now.
          </AlertDescription>
        </Alert>
      ) : null}

      <Section
        title="Missing from the shelf"
        blurb="The system expects these but nobody found them. Almost always a piece sold at the counter that was never scanned out. Correcting brings the website's stock down to what is really there."
        lines={report.missing}
        onError={setError}
        readOnly={done}
      />

      <Section
        title="More than expected"
        blurb="Found on the shelf but not in the system. Usually a delivery entered twice, or a piece scanned out that never actually left."
        lines={report.extra}
        onError={setError}
        readOnly={done}
      />

      {report.unknown.length > 0 ? (
        <div className="rounded-lg border bg-background p-5">
          <h2 className="font-medium">Tags nobody recognises</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            These belong to no piece in the system. Nothing can be corrected from
            them — they are here so you can look at the label itself.
          </p>
          <ul className="divide-y">
            {report.unknown.map((line) => (
              <li key={line.lineId} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1 font-mono">{line.scannedCode}</span>
                <span className="text-muted-foreground">
                  found {line.countedQty}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.settled.length > 0 ? (
        <div className="rounded-lg border bg-background p-5">
          <h2 className="mb-3 font-medium">Already decided</h2>
          <ul className="divide-y">
            {report.settled.map((line) => (
              <li key={line.lineId} className="flex flex-wrap items-center gap-x-3 py-2 text-sm">
                <span className="flex-1">
                  {line.productName}
                                  </span>
                <span className="text-muted-foreground tabular-nums">
                  expected {line.expectedQty}, found {line.countedQty}
                </span>
                <span
                  className={
                    line.applied
                      ? "flex items-center gap-1 text-emerald-700 dark:text-emerald-500"
                      : "text-muted-foreground"
                  }
                >
                  {line.applied ? (
                    <>
                      <Check className="size-3.5" aria-hidden /> corrected
                    </>
                  ) : (
                    "left alone"
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stocktake.status === "COUNTED" ? (
        <div className="rounded-lg border bg-background p-5">
          <h2 className="font-medium">Finish with this count</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {stocktake.openDifferences > 0
              ? `${stocktake.openDifferences} difference${stocktake.openDifferences === 1 ? "" : "s"} still waiting. Correct or leave each one, then close.`
              : "Everything has been decided. Closing files the count away as a record."}
          </p>
          <Button
            type="button"
            disabled={closing || stocktake.openDifferences > 0}
            onClick={() => void close()}
          >
            {closing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Close the count"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn";
}) {
  return (
    <div>
      <p
        className={
          tone === "warn"
            ? "text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-500"
            : "text-2xl font-semibold tabular-nums"
        }
      >
        {value}
      </p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({
  title,
  blurb,
  lines,
  onError,
  readOnly,
}: {
  title: string;
  blurb: string;
  lines: StocktakeLineView[];
  onError: (message: string) => void;
  readOnly: boolean;
}) {
  if (lines.length === 0) return null;

  return (
    <div className="rounded-lg border bg-background p-5">
      <h2 className="font-medium">
        {title} — {lines.length}
      </h2>
      <p className="mb-3 max-w-2xl text-sm text-muted-foreground">{blurb}</p>

      <ul className="divide-y">
        {lines.map((line) => (
          <LineRow
            key={line.lineId}
            line={line}
            onError={onError}
            readOnly={readOnly}
          />
        ))}
      </ul>
    </div>
  );
}

function LineRow({
  line,
  onError,
  readOnly,
}: {
  line: StocktakeLineView;
  onError: (message: string) => void;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // The count described the shelf at one moment. If stock has moved since, the
  // old figure would undo whatever happened in between, so the row says to
  // count it again instead of offering a button that will be refused.
  const moved = line.currentQty !== null && line.currentQty !== line.expectedQty;

  async function act(body: Record<string, unknown>, fallback: string) {
    setBusy(true);

    try {
      await postJson("/api/admin/stock-take", body);
      router.refresh();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {line.productName}
                  </p>
        <p className="text-sm text-muted-foreground">
          Expected {line.expectedQty}, found {line.countedQty}
          {line.code ? ` · ${line.code}` : ""}
        </p>
        {moved ? (
          <p className="text-sm text-amber-700 dark:text-amber-500">
            Stock has changed since the count — it is {line.currentQty} now.
            Count this piece again rather than applying the old figure.
          </p>
        ) : null}
      </div>

      {!readOnly ? (
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || moved}
            onClick={() =>
              void act(
                { action: "apply", lineId: line.lineId },
                "Could not apply that correction.",
              )
            }
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              `Set stock to ${line.countedQty}`
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void act(
                { action: "skip", lineId: line.lineId, skip: true },
                "Could not leave that alone.",
              )
            }
          >
            Leave it
          </Button>
        </div>
      ) : null}
    </li>
  );
}
