"use client";

import { Check, Loader2, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SupplierPicker, type PickedSupplier } from "@/components/admin/supplier-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, getJson, requestJson } from "@/lib/api-client";
import type { RestockCandidate, RestockResult } from "@/lib/queries/restock";

/**
 * More of something the shop already has.
 *
 * Deliberately not part of the check-in form. Checking a delivery in asks for a
 * name, a type, photos and new tags; this asks for a quantity and what the
 * batch cost, and nothing else. Mixing them would put six fields the owner must
 * ignore in front of the one that matters.
 *
 * Search by scanning the tag on the piece in hand where possible. Two seasons
 * of the same design can share a name, and the tag is the only thing that
 * cannot land on the wrong one.
 */

type Chosen = {
  candidate: RestockCandidate;
  costPrice: string;
  /** How many arrived. One field, because a product is one piece. */
  quantity: string;
};

export function RestockForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RestockCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const [supplier, setSupplier] = useState<PickedSupplier | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RestockResult | null>(null);

  // Ignores a slow response that arrives after a newer one, so typing "ban"
  // then "banarasi" cannot leave the earlier results on screen.
  const latest = useRef(0);

  const term = query.trim();
  // Nothing is cleared on a short term: the results simply stop being shown.
  // Emptying state from inside the effect would set state during render and
  // start a second render for no reason.
  const shown = term.length >= 2 ? results : [];

  useEffect(() => {
    if (term.length < 2) return;

    const ticket = ++latest.current;

    const timer = setTimeout(() => {
      setSearching(true);

      getJson<{ candidates: RestockCandidate[] }>(
        `/api/admin/restock?q=${encodeURIComponent(term)}`,
      )
        .then((data) => {
          if (ticket === latest.current) setResults(data.candidates);
        })
        .catch(() => {
          if (ticket === latest.current) setResults([]);
        })
        .finally(() => {
          if (ticket === latest.current) setSearching(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [term]);

  function choose(candidate: RestockCandidate) {
    setQuery("");
    setResults([]);
    setDone(null);

    setChosen((all) =>
      all.some((item) => item.candidate.productId === candidate.productId)
        ? all
        : [
            ...all,
            { candidate, costPrice: candidate.currentCost ?? "", quantity: "1" },
          ],
    );
  }

  function update(productId: string, change: Partial<Chosen>) {
    setChosen((all) =>
      all.map((item) =>
        item.candidate.productId === productId ? { ...item, ...change } : item,
      ),
    );
  }

  async function submit() {
    setError(null);

    const lines = chosen
      .map((item) => ({
        productId: item.candidate.productId,
        costPrice: item.costPrice.trim(),
        quantity: Number(item.quantity),
      }))
      .filter((line) => Number.isInteger(line.quantity) && line.quantity > 0);

    if (lines.length === 0) {
      setError("Enter how many pieces arrived.");
      return;
    }

    if (lines.some((line) => line.costPrice === "")) {
      setError("Enter what each piece cost in this batch.");
      return;
    }

    setBusy(true);

    try {
      const result = await requestJson<RestockResult>("/api/admin/restock", "POST", {
        supplierId: supplier?.id ?? null,
        note: note.trim(),
        lines,
      });

      setDone(result);
      setChosen([]);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {done ? (
        <Alert>
          <Check className="size-4" aria-hidden />
          <AlertDescription>
            <span className="font-medium">
              {done.piecesAdded} {done.piecesAdded === 1 ? "piece" : "pieces"} added
              as {done.purchaseNumber}.
            </span>
            <ul className="mt-1 space-y-0.5 text-sm">
              {done.costChanges.map((change) => (
                <li key={change.productId}>
                  {change.name} — cost{" "}
                  {change.unchanged ? (
                    <>unchanged at ₹{change.to}</>
                  ) : (
                    <>
                      {change.from === null ? "set to" : `₹${change.from} → `}₹{change.to}{" "}
                      {change.from === null ? "" : "(weighted average)"}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-lg border bg-background p-5">
        <Label htmlFor="restock-search">Which piece arrived again?</Label>
        <div className="relative mt-2">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="restock-search"
            value={query}
            autoComplete="off"
            placeholder="Scan the tag, or type a name or code"
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Scan the tag where you can. Two seasons of the same design often share
          a name, and only the tag cannot land on the wrong one.
        </p>

        {searching ? (
          <p className="mt-3 text-sm text-muted-foreground">Looking…</p>
        ) : null}

        {shown.length > 0 ? (
          <ul className="mt-3 divide-y rounded-md border">
            {shown.map((candidate) => (
              <li key={candidate.productId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-muted/60"
                  onClick={() => choose(candidate)}
                >
                  {candidate.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={candidate.imageUrl}
                      alt=""
                      className="size-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="size-10 shrink-0 rounded bg-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{candidate.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      <span className="font-mono">{candidate.code ?? "no code"}</span> ·{" "}
                      {candidate.onHand} on hand
                      {candidate.currentCostFormatted
                        ? ` · cost ${candidate.currentCostFormatted}`
                        : " · no cost yet"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {term.length >= 2 && !searching && shown.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing matches. If it is a new design, check it in instead.
          </p>
        ) : null}
      </div>

      {chosen.map((item) => (
        <ChosenCard
          key={item.candidate.productId}
          item={item}
          onChange={(change) => update(item.candidate.productId, change)}
          onRemove={() =>
            setChosen((all) =>
              all.filter((other) => other.candidate.productId !== item.candidate.productId),
            )
          }
        />
      ))}

      {chosen.length > 0 ? (
        <>
          <div className="rounded-lg border bg-background p-5">
            <Label>Who delivered it?</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Leave this empty for pieces that were already in the shop.
            </p>
            <SupplierPicker value={supplier} onChange={setSupplier} />

            <div className="mt-4">
              <Label htmlFor="restock-note">Anything to remember</Label>
              <Textarea
                id="restock-note"
                value={note}
                rows={2}
                className="mt-1"
                placeholder="Optional"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="button" size="lg" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Add the stock"}
          </Button>
        </>
      ) : null}
    </div>
  );
}

/**
 * One piece being restocked.
 *
 * Cost sits on the card rather than on each size, because the same design never
 * costs different amounts in different sizes — putting the field per size would
 * invite an inconsistency the shop cannot act on.
 */
function ChosenCard({
  item,
  onChange,
  onRemove,
}: {
  item: Chosen;
  onChange: (change: Partial<Chosen>) => void;
  onRemove: () => void;
}) {
  const { candidate } = item;

  const parsed = Number(item.quantity);
  const addedQty = Number.isInteger(parsed) && parsed > 0 ? parsed : 0;

  return (
    <div className="rounded-lg border bg-background p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{candidate.name}</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{candidate.code ?? "no code"}</span> ·{" "}
            {candidate.onHand} on hand
            {candidate.currentCostFormatted
              ? ` · cost now ${candidate.currentCostFormatted}`
              : " · no cost recorded yet"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Remove ${candidate.name}`}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`cost-${candidate.productId}`}>
            What each piece cost in this batch
          </Label>
          <Input
            id={`cost-${candidate.productId}`}
            value={item.costPrice}
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1"
            onChange={(event) => onChange({ costPrice: event.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            The stored cost becomes the average of the old stock and this batch.
            What earlier batches and past orders cost never changes.
          </p>
        </div>

        <div>
          <Label htmlFor={`qty-${candidate.productId}`}>How many arrived</Label>
          <Input
            id={`qty-${candidate.productId}`}
            type="number"
            min={0}
            inputMode="numeric"
            value={item.quantity}
            className="mt-1 w-28 tabular-nums"
            onChange={(event) => onChange({ quantity: event.target.value })}
          />
          {addedQty > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {candidate.onHand} on hand → {candidate.onHand + addedQty} after this
            </p>
          ) : null}
          {candidate.piece === null ? (
            <p className="mt-2 text-sm text-destructive">
              This product has nothing to add stock to. Open it in Products and
              save it once.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
