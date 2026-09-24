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

/**
 * At or below this, the shopper is told how few are left.
 *
 * This is a SCARCITY CUE for the customer, not a restock warning for the
 * shop. Most pieces here are held one or two at a time, so "Only 1 left" is
 * simply true — and it is the most useful thing a shopper can know about a
 * saree they are hesitating over.
 */
const SCARCITY_THRESHOLD = 3;

/** A variant with no size recorded still needs a label to pick. */
function labelFor(variant: VariantOption): string {
  return variant.size ?? "Free Size";
}

/**
 * True when the product is one-size, so there is no choice to make.
 *
 * Only then is a size picked automatically. A product with real sizes still
 * requires a deliberate tap, because packing the wrong size is a return.
 */
function isOneSizeOnly(variants: VariantOption[]): boolean {
  if (variants.length !== 1) return false;
  const only = variants[0];
  if (only.stockQty <= 0) return false;
  return (
    only.size === null || only.size.trim().toLowerCase().replace(/\s+/g, "") === "freesize"
  );
}

/**
 * Size picker plus the buy actions.
 *
 * SIZE IS ALWAYS REQUIRED. Nothing is pre-selected and "Add to bag" stays
 * disabled until the shopper picks an option — even when a product has only
 * one. A garment cannot be packed without knowing which size was meant, so the
 * choice has to be deliberate rather than defaulted.
 *
 * The wishlist is different on purpose: saving something for later does not
 * commit to a size, so the heart works with nothing selected.
 */
export function ProductActions({
  productId,
  variants,
}: {
  productId: string;
  variants: VariantOption[];
}) {
  // Empty by default. The one exception is a one-size product, where there is
  // nothing for the shopper to decide.
  const [selectedId, setSelectedId] = useState(() =>
    isOneSizeOnly(variants) ? variants[0].id : "",
  );
  const [justAdded, setJustAdded] = useState(false);
  const [showSizeHint, setShowSizeHint] = useState(false);

  const addToCart = useCartStore((state) => state.add);
  const cartError = useCartStore((state) => state.error);
  const dismissCartError = useCartStore((state) => state.dismissError);
  const isAdding = useCartStore((state) => state.pending[selectedId] ?? false);

  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const saved = useWishlistStore((state) =>
    state.wishlist.productIds.includes(productId),
  );
  const isSaving = useWishlistStore((state) => state.pending[productId] ?? false);

  const selected = variants.find((variant) => variant.id === selectedId) ?? null;

  // A client-side move to another product can reuse this component, so the
  // selection is re-derived whenever the options themselves change.
  // Depend on the ids themselves, not the array identity, so an ordinary
  // re-render cannot wipe a selection the shopper just made.
  const variantKey = variants.map((variant) => variant.id).join(",");

  useEffect(() => {
    setSelectedId(isOneSizeOnly(variants) ? variants[0].id : "");
    setShowSizeHint(false);
    setJustAdded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantKey]);

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

  const anyInStock = variants.some((variant) => variant.stockQty > 0);

  async function onAdd() {
    if (!selected) {
      setShowSizeHint(true);
      return;
    }

    const ok = await addToCart(selected.id, 1);
    if (ok) setJustAdded(true);
  }

  const oneSize = isOneSizeOnly(variants);

  return (
    <div className="space-y-4">
      {oneSize ? (
        // Nothing to choose, so nothing to ask for.
        <p className="text-sm text-muted-foreground">One size</p>
      ) : (
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Size
          <span aria-hidden className="ml-1 text-destructive">
            *
          </span>
          <span className="sr-only">(required)</span>
        </legend>

        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => {
            const soldOut = variant.stockQty <= 0;
            const isSelected = variant.id === selectedId;

            return (
              <button
                key={variant.id}
                type="button"
                disabled={soldOut}
                onClick={() => {
                  setSelectedId(variant.id);
                  setShowSizeHint(false);
                  setJustAdded(false);
                }}
                aria-pressed={isSelected}
                aria-label={
                  soldOut
                    ? `${labelFor(variant)} — out of stock`
                    : labelFor(variant)
                }
                className={cn(
                  "min-w-16 rounded-md border px-3 py-2 text-sm transition",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                  // Chosen
                  isSelected &&
                    !soldOut &&
                    "border-foreground bg-foreground text-background",
                  // Available, not chosen
                  !isSelected && !soldOut && "hover:border-foreground/40",
                  // Unavailable: struck through with a single line, and greyed
                  // back so it reads as "exists, but not right now".
                  soldOut &&
                    "cursor-not-allowed border-muted bg-muted/30 text-muted-foreground/60 line-through decoration-1",
                )}
              >
                {labelFor(variant)}
              </button>
            );
          })}
        </div>
      </fieldset>
      )}

      {selected ? (
        <p className="text-sm" aria-live="polite">
          {selected.stockQty <= SCARCITY_THRESHOLD ? (
            <span className="font-medium text-amber-700 dark:text-amber-500">
              Only {selected.stockQty} left
            </span>
          ) : (
            <span className="text-muted-foreground">In stock</span>
          )}
          <span className="text-muted-foreground"> · {formatInr(selected.price)}</span>
        </p>
      ) : (
        <p
          className={cn(
            "text-sm",
            showSizeHint ? "font-medium text-destructive" : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {anyInStock
            ? "Please select a size to continue."
            : "Every size is currently out of stock."}
        </p>
      )}

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
          // Disabled without a size, so the requirement is visible rather than
          // only enforced after a click.
          disabled={!anyInStock || !selected || isAdding}
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
          ) : !anyInStock ? (
            "Out of stock"
          ) : !selected ? (
            "Select a size"
          ) : (
            "Add to bag"
          )}
        </Button>

        {/* No size needed to save something for later. */}
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
