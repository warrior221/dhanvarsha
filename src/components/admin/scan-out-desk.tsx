"use client";

import { AlertTriangle, Check, Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, requestJson } from "@/lib/api-client";
import type { ScanRecord, ScannedPiece } from "@/lib/queries/scan-out";

/**
 * The counter desk: scan a tag, the piece leaves stock.
 *
 * NOT BILLING. The bill is still written in the bill book. There is no price to
 * edit, no total, no payment and no customer — one action, one piece off the
 * shelf, so the website's stock stays true.
 *
 * A USB scanner behaves as a keyboard: it types the code and presses Enter. So
 * the box is a plain text input that submits on Enter and takes focus back
 * after every scan, because the next piece is usually already in hand.
 */

const TIME = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export function ScanOutDesk({ initialScans }: { initialScans: ScanRecord[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ piece: ScannedPiece; remaining: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ name: string; size: string | null }[]>([]);

  // The box must be ready the moment the page opens, and again after every
  // scan — a scanner types wherever the focus happens to be.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit() {
    const barcode = code.trim();
    if (barcode === "" || busy) return;

    setBusy(true);
    setError(null);

    try {
      const result = await requestJson<{ piece: ScannedPiece; remaining: number }>(
        "/api/admin/scan-out",
        "POST",
        { barcode, preview: false },
      );

      setLast(result);
      setSession((all) => [
        { name: result.piece.productName, size: result.piece.size },
        ...all,
      ]);
      router.refresh();
    } catch (err) {
      setLast(null);
      setError(err instanceof ApiError ? err.message : "Could not read that tag.");
    } finally {
      setCode("");
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function undo(record: ScanRecord) {
    const note = window.prompt(
      `Putting "${record.productName}" back into stock. Why?`,
      "Scanned by mistake",
    );

    if (!note || note.trim().length < 3) return;

    try {
      await requestJson("/api/admin/scan-out", "PUT", {
        movementId: record.movementId,
        note: note.trim(),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not put that back.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <div className="rounded-lg border bg-background p-5">
          <label htmlFor="scan" className="text-sm font-medium">
            Scan a tag
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id="scan"
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
                  void submit();
                }
              }}
            />
            <Button
              type="button"
              size="lg"
              disabled={busy || code.trim() === ""}
              onClick={() => void submit()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Take out"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            This only takes the piece out of stock. The bill is still written in
            the bill book.
          </p>
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertTriangle className="size-4" aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {last ? (
          <div className="flex items-center gap-4 rounded-lg border-2 border-emerald-600/40 bg-emerald-50/50 p-4 dark:bg-emerald-950/20">
            {last.piece.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={last.piece.imageUrl}
                alt=""
                className="size-16 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="size-16 shrink-0 rounded bg-muted" />
            )}

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-medium">
                <Check className="size-4 text-emerald-700 dark:text-emerald-500" aria-hidden />
                {last.piece.productName}
              </p>
              <p className="text-sm text-muted-foreground">
                {last.piece.size ? `Size ${last.piece.size} · ` : ""}
                {last.piece.sku}
              </p>
            </div>

            <p className="shrink-0 text-right text-sm">
              <span className="block text-2xl font-semibold tabular-nums">
                {last.remaining}
              </span>
              <span className="text-muted-foreground">left</span>
            </p>
          </div>
        ) : null}

        {session.length > 0 ? (
          <div className="rounded-lg border bg-background p-5">
            <h2 className="mb-3 text-sm font-medium">
              This session — {session.length} {session.length === 1 ? "piece" : "pieces"}
            </h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {session.map((item, index) => (
                <li key={index}>
                  {item.name}
                  {item.size ? ` · ${item.size}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <aside className="rounded-lg border bg-background p-5">
        <h2 className="mb-3 text-lg font-medium">Today</h2>

        {initialScans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scanned out yet today.</p>
        ) : (
          <ul className="divide-y">
            {initialScans.map((record) => (
              <li key={record.movementId} className="flex items-start gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      record.undone
                        ? "text-sm text-muted-foreground line-through"
                        : "text-sm font-medium"
                    }
                  >
                    {record.productName}
                    {record.size ? ` · ${record.size}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {TIME.format(new Date(record.at))}
                    {record.by ? ` · ${record.by}` : ""}
                    {record.undone ? " · put back" : ""}
                  </p>
                </div>

                {!record.undone ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs"
                    aria-label={`Put ${record.productName} back into stock`}
                    onClick={() => void undo(record)}
                  >
                    <Undo2 className="size-3.5" aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
