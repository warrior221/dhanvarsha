"use client";

import { useState } from "react";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";

export type VariantOption = {
  id: string;
  size: string | null;
  price: string;
  stockQty: number;
};

const LOW_STOCK_THRESHOLD = 3;

/**
 * Size picker showing per-variant stock.
 *
 * There is deliberately no "Add to cart" button here yet — the cart is Phase 5.
 * A button wired to nothing would be a mock implementation (spec 1.2).
 */
export function VariantPicker({ variants }: { variants: VariantOption[] }) {
  const firstAvailable = variants.find((variant) => variant.stockQty > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstAvailable?.id ?? "");

  const selected = variants.find((variant) => variant.id === selectedId) ?? firstAvailable;

  if (variants.length === 0) {
    return <p className="text-sm text-muted-foreground">This product has no options set up yet.</p>;
  }

  // A saree with no sizes is a single variant; showing a one-button "picker"
  // would be noise, so only the stock line is rendered.
  const isSingleUnsized = variants.length === 1 && variants[0]!.size === null;

  return (
    <div className="space-y-4">
      {!isSingleUnsized ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Size</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const soldOut = variant.stockQty <= 0;
              const isSelected = variant.id === selected?.id;

              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={soldOut}
                  onClick={() => setSelectedId(variant.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "min-w-14 rounded-md border px-3 py-2 text-sm transition",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                    isSelected && !soldOut && "border-foreground bg-foreground text-background",
                    soldOut &&
                      "cursor-not-allowed text-muted-foreground line-through opacity-50",
                  )}
                >
                  {variant.size ?? "One size"}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {selected ? (
        <p className="text-sm" aria-live="polite">
          {selected.stockQty <= 0 ? (
            <span className="font-medium text-destructive">Out of stock</span>
          ) : selected.stockQty <= LOW_STOCK_THRESHOLD ? (
            <span className="font-medium text-amber-700 dark:text-amber-500">
              Only {selected.stockQty} left
            </span>
          ) : (
            <span className="text-muted-foreground">In stock</span>
          )}
          {!isSingleUnsized && selected.stockQty > 0 ? (
            <span className="text-muted-foreground">
              {" "}
              · {formatInr(selected.price)}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
