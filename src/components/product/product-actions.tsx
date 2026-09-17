"use client";

import { Check, Heart, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";

export type VariantOption = {
  id: string;
  size: string | null;
  price: string;
  stockQty: number;
};

const LOW_STOCK_THRESHOLD = 3;

/**
 * Size picker plus the buy actions. Selection and the actions live in one
 * component because "add to bag" needs to know which size is chosen.
 *
 * Stock shown here is only a hint; the server re-checks on every add and is
 * the one that can refuse (spec 7).
 */
export function ProductActions({
  productId,
  variants,
}: {
  productId: string;
  variants: VariantOption[];
}) {
  const firstAvailable = variants.find((variant) => variant.stockQty > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstAvailable?.id ?? "");
  const [justAdded, setJustAdded] = useState(false);

  const addToCart = useCartStore((state) => state.add);
  const cartError = useCartStore((state) => state.error);
  const dismissCartError = useCartStore((state) => state.dismissError);
  const isAdding = useCartStore((state) => state.pending[selectedId] ?? false);

  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const saved = useWishlistStore((state) => state.wishlist.productIds.includes(productId));
  const isSaving = useWishlistStore((state) => state.pending[productId] ?? false);

  const selected = variants.find((variant) => variant.id === selectedId) ?? firstAvailable;

  // Clear the "Added" confirmation after a moment.
  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(false), 2500);
    return () => clearTimeout(timer);
  }, [justAdded]);

  if (variants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This product has no options set up yet.
      </p>
    );
  }

  // A saree with no sizes is a single variant; a one-button "picker" would be
  // noise, so only the stock line is shown.
  const isSingleUnsized = variants.length === 1 && variants[0]!.size === null;
  const soldOut = !selected || selected.stockQty <= 0;

  async function onAdd() {
    if (!selected) return;
    const ok = await addToCart(selected.id, 1);
    if (ok) setJustAdded(true);
  }

  return (
    <div className="space-y-4">
      {!isSingleUnsized ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Size</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const variantSoldOut = variant.stockQty <= 0;
              const isSelected = variant.id === selected?.id;

              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={variantSoldOut}
                  onClick={() => {
                    setSelectedId(variant.id);
                    setJustAdded(false);
                  }}
                  aria-pressed={isSelected}
                  className={cn(
                    "min-w-14 rounded-md border px-3 py-2 text-sm transition",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                    isSelected &&
                      !variantSoldOut &&
                      "border-foreground bg-foreground text-background",
                    variantSoldOut &&
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
          {soldOut ? (
            <span className="font-medium text-destructive">Out of stock</span>
          ) : selected.stockQty <= LOW_STOCK_THRESHOLD ? (
            <span className="font-medium text-amber-700 dark:text-amber-500">
              Only {selected.stockQty} left
            </span>
          ) : (
            <span className="text-muted-foreground">In stock</span>
          )}
          {!isSingleUnsized && !soldOut ? (
            <span className="text-muted-foreground"> · {formatInr(selected.price)}</span>
          ) : null}
        </p>
      ) : null}

      {cartError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex items-start justify-between gap-2">
            <span>{cartError}</span>
            <button
              type="button"
              onClick={dismissCartError}
              className="shrink-0 underline underline-offset-4"
            >
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          size="lg"
          disabled={soldOut || isAdding}
          onClick={() => void onAdd()}
        >
          {isAdding ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Adding…
            </>
          ) : justAdded ? (
            <>
              <Check className="size-4" aria-hidden />
              Added to bag
            </>
          ) : soldOut ? (
            "Out of stock"
          ) : (
            "Add to bag"
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isSaving}
          aria-pressed={saved}
          aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
          onClick={() => void toggleWishlist(productId)}
        >
          <Heart
            className={cn("size-4", saved && "fill-current text-rose-600")}
            aria-hidden
          />
        </Button>
      </div>
    </div>
  );
}
