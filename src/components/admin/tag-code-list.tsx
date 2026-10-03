"use client";

import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { TagCodeRow } from "@/lib/queries/tag-codes";

/**
 * The codes as plain text, ready to copy.
 *
 * No barcode drawn, no PDF, no printing: the owner pastes these into their own
 * barcode converter. So the whole screen is one selectable text block, tab
 * separated, which is what spreadsheets and converters read.
 *
 * "One line per piece" exists because a code belongs to a SIZE, and every piece
 * of that size carries the same code. Looking a code up needs one line; printing
 * labels needs one line per piece on the shelf, so both are offered rather than
 * making the owner count.
 */
export function TagCodeList({ rows }: { rows: TagCodeRow[] }) {
  const [filter, setFilter] = useState("");
  const [inStockOnly, setInStockOnly] = useState(true);
  const [perPiece, setPerPiece] = useState(false);
  const [copied, setCopied] = useState(false);

  const missingCodes = rows.filter((row) => row.code === null).length;

  const lines = useMemo(() => {
    const term = filter.trim().toLowerCase();

    const matching = rows.filter((row) => {
      if (row.code === null) return false;
      if (inStockOnly && row.stockQty < 1) return false;

      if (term === "") return true;

      return (
        row.productName.toLowerCase().includes(term) ||
        row.code.toLowerCase().includes(term)
      );
    });

    return matching.flatMap((row) => {
      const text = [row.productName, row.code].join("\t");
      // One line per piece on the shelf, which is one line per label to print.
      const times = perPiece ? Math.max(row.stockQty, 0) : 1;

      return Array.from({ length: times }, () => text);
    });
  }, [rows, filter, inStockOnly, perPiece]);

  const text = lines.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission refused, or an older browser. The text is on
      // screen and selectable, so there is nothing to recover from.
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-background p-5">
        <div className="min-w-56 flex-1">
          <Label htmlFor="tag-filter">Find a piece</Label>
          <Input
            id="tag-filter"
            value={filter}
            autoComplete="off"
            placeholder="Name or code"
            className="mt-1"
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="in-stock-only"
            checked={inStockOnly}
            onCheckedChange={setInStockOnly}
          />
          <Label htmlFor="in-stock-only" className="font-normal">
            Only pieces in stock
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="per-piece" checked={perPiece} onCheckedChange={setPerPiece} />
          <Label htmlFor="per-piece" className="font-normal">
            One line per piece
          </Label>
        </div>

        <Button type="button" variant="outline" disabled={lines.length === 0} onClick={() => void copy()}>
          {copied ? (
            <>
              <Check className="size-4" aria-hidden /> Copied
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden /> Copy all
            </>
          )}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {lines.length} {lines.length === 1 ? "line" : "lines"}
        {perPiece
          ? " — one per piece on the shelf, so this is how many labels to print."
          : " — one per size. Every piece of a size carries the same code."}
        {" "}Name, size and code, separated by tabs.
      </p>

      {missingCodes > 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-500">
          {missingCodes} {missingCodes === 1 ? "size has" : "sizes have"} no code
          yet and {missingCodes === 1 ? "is" : "are"} left out. Run{" "}
          <code className="font-mono text-xs">npx tsx scripts/backfill-barcodes.ts</code>{" "}
          to give {missingCodes === 1 ? "it" : "them"} one.
        </p>
      ) : null}

      {lines.length === 0 ? (
        <div className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">
          Nothing matches.
        </div>
      ) : (
        // A plain <pre> on purpose: select all, copy, paste. A table would look
        // tidier and paste as a mess.
        <pre className="max-h-[32rem] overflow-auto rounded-lg border bg-muted/30 p-4 font-mono text-sm leading-6 select-all">
          {text}
        </pre>
      )}
    </div>
  );
}
