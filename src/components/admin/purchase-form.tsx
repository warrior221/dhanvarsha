"use client";

import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImageUploader, type EditableImage } from "@/components/admin/image-uploader";
import { SupplierPicker, type PickedSupplier } from "@/components/admin/supplier-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, requestJson } from "@/lib/api-client";

/**
 * Checking a delivery in.
 *
 * One line per design, and the shape of the screen follows how the goods
 * actually arrive: the weaver is standing there, the pile is on the counter,
 * and what matters is what it cost and how many came. Selling price is not
 * asked for — that decision happens later, and pricing is what puts a piece on
 * the shop.
 */

type Row = { size: string | null; quantity: number };

type Line = {
  key: string;
  categoryId: string;
  name: string;
  costPrice: string;
  rows: Row[];
  images: EditableImage[];
};

function blankLine(categoryId: string): Line {
  return {
    key: crypto.randomUUID(),
    categoryId,
    name: "",
    costPrice: "",
    // One unsized row by default, which is a saree. Sizes are added only for
    // readymade pieces, where each one is its own variant with its own tag.
    rows: [{ size: null, quantity: 1 }],
    images: [],
  };
}

export function PurchaseForm({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [supplier, setSupplier] = useState<PickedSupplier | null>(null);
  const [isOpeningStock, setIsOpeningStock] = useState(false);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine(categories[0]?.id ?? "")]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function patchLine(key: string, patch: Partial<Line>) {
    setLines((all) => all.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  const totalPieces = lines.reduce(
    (sum, line) => sum + line.rows.reduce((n, row) => n + (row.quantity || 0), 0),
    0,
  );

  async function save() {
    setBusy(true);
    setError(null);

    try {
      const result = await requestJson<{
        purchaseNumber: string;
        productsCreated: number;
        piecesAdded: number;
      }>("/api/admin/purchases", "POST", {
        supplierId: supplier?.id ?? null,
        isOpeningStock,
        note,
        lines: lines.map((line) => ({
          categoryId: line.categoryId,
          name: line.name,
          costPrice: line.costPrice,
          rows: line.rows,
          images: line.images,
        })),
      });

      setDone(
        `${result.purchaseNumber}: ${result.productsCreated} ${result.productsCreated === 1 ? "design" : "designs"}, ${result.piecesAdded} ${result.piecesAdded === 1 ? "piece" : "pieces"} added to stock.`,
      );
      setLines([blankLine(categories[0]?.id ?? "")]);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record that delivery.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {done ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{done}</span>
            <a
              href="/admin/products/unpriced"
              className="font-medium underline underline-offset-4"
            >
              Price them now
            </a>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3 rounded-lg border bg-background p-5">
        <h2 className="text-lg font-medium">Who it came from</h2>

        {isOpeningStock ? (
          <p className="text-sm text-muted-foreground">
            Stock already in the shop needs no weaver. Turn this off to record a
            delivery from someone.
          </p>
        ) : (
          <SupplierPicker value={supplier} onChange={setSupplier} />
        )}

        <label className="flex items-center gap-2 pt-1 text-sm">
          <Switch
            checked={isOpeningStock}
            onCheckedChange={(checked) => {
              setIsOpeningStock(checked);
              if (checked) setSupplier(null);
            }}
          />
          This is stock already in the shop, not a new delivery
        </label>
      </section>

      {lines.map((line, index) => (
        <section key={line.key} className="space-y-4 rounded-lg border bg-background p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Piece {index + 1}</h2>
            {lines.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove piece ${index + 1}`}
                onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`type-${line.key}`}>Type</Label>
              <select
                id={`type-${line.key}`}
                value={line.categoryId}
                onChange={(event) => patchLine(line.key, { categoryId: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`cost-${line.key}`}>Cost price (₹)</Label>
              <Input
                id={`cost-${line.key}`}
                inputMode="decimal"
                value={line.costPrice}
                placeholder="4200"
                onChange={(event) => patchLine(line.key, { costPrice: event.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`name-${line.key}`}>Name (optional)</Label>
              <Input
                id={`name-${line.key}`}
                value={line.name}
                placeholder="Named after its type if left blank"
                onChange={(event) => patchLine(line.key, { name: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>How many</Label>
            {line.rows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Size</span>
                  <Input
                    value={row.size ?? ""}
                    placeholder="One size"
                    className="w-32"
                    aria-label={`Size for row ${rowIndex + 1}`}
                    onChange={(event) => {
                      const next = [...line.rows];
                      next[rowIndex] = {
                        ...row,
                        size: event.target.value.trim() === "" ? null : event.target.value,
                      };
                      patchLine(line.key, { rows: next });
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Quantity</span>
                  <Input
                    inputMode="numeric"
                    value={String(row.quantity)}
                    className="w-24"
                    aria-label={`Quantity for row ${rowIndex + 1}`}
                    onChange={(event) => {
                      const next = [...line.rows];
                      next[rowIndex] = {
                        ...row,
                        quantity: Number(event.target.value.replace(/\D/g, "")) || 0,
                      };
                      patchLine(line.key, { rows: next });
                    }}
                  />
                </div>

                {line.rows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove row ${rowIndex + 1}`}
                    onClick={() =>
                      patchLine(line.key, {
                        rows: line.rows.filter((_, i) => i !== rowIndex),
                      })
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                patchLine(line.key, { rows: [...line.rows, { size: "", quantity: 1 }] })
              }
            >
              <Plus className="size-4" aria-hidden />
              Add a size
            </Button>
            <p className="text-xs text-muted-foreground">
              Leave the size blank for a saree. Add a row per size for readymade
              pieces — each size gets its own tag.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Photos</Label>
            <ImageUploader
              images={line.images}
              onChange={(images) => patchLine(line.key, { images })}
            />
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setLines((all) => [...all, blankLine(categories[0]?.id ?? "")])}
        >
          <Plus className="size-4" aria-hidden />
          Another piece
        </Button>

        <div className="flex-1" />

        <Button type="button" size="lg" disabled={busy} onClick={() => void save()}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Recording…
            </>
          ) : (
            <>
              <Check className="size-4" aria-hidden />
              Check in {totalPieces} {totalPieces === 1 ? "piece" : "pieces"}
            </>
          )}
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="purchase-note">Note (optional)</Label>
        <Textarea
          id="purchase-note"
          rows={2}
          value={note}
          placeholder="Anything worth remembering about this delivery."
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </div>
  );
}
