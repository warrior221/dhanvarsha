"use client";

import { Check, Heart, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";

/** The one piece a product is. There are no sizes and nothing to choose. */
export type PieceOption = {
  id: string;
  price: string;
  stockQty: number;
};

/**
 * At or below this, the shopper is told how few are left.
 *
 * This is a SCARCITY CUE for the customer, not a restock warning for the shop.
 * Most pieces here are held one or two at a time, so "Only 1 left" is simply
 * true — and it is the most useful thing a shopper can know about a saree they
 * are hesitating over.
 */
const SCARCITY_THRESHOLD = 3;

/**
 * The buy actions.
 *
 * NO SIZE PICKER. Every piece this shop sells is one size, so a product has one
 * variant and there is nothing to ask. Add to bag adds that piece. Colours are
 * separate products, offered by the colour switcher above rather than chosen
 * here.
 */
export function ProductActions({
  productId,
  piece,
}: {
  productId: string;
  piece: PieceOption | null;
}) {
  /** The piece id whose "Added to bag" flash is showing, or null. */
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const addToCart = useCartStore((state) => state.add);
  const cartError = useCartStore((state) => state.error);
  const dismissCartError = useCartStore((state) => state.dismissError);
  const isAdding = useCartStore((state) => state.pending[piece?.id ?? ""] ?? false);

  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const saved = useWishlistStore((state) =>
    state.wishlist.productIds.includes(productId),
  );
  const isSaving = useWishlistStore((state) => state.pending[productId] ?? false);

  // A client-side move to another colour can reuse this component, so the
  // "Added" flash is keyed to the piece it belongs to rather than cleared from
  // an effect. Clearing it in an effect would set state during a render that has
  // already happened, and start a second one for nothing.
  const flashing = justAdded === piece?.id;

  useEffect(() => {
    if (justAdded === null) return;
    const timer = setTimeout(() => setJustAdded(null), 2500);
    return () => clearTimeout(timer);
  }, [justAdded]);

  if (piece === null) {
    return (
      <p className="text-sm text-muted-foreground">
        This piece is not set up for sale yet.
      </p>
    );
  }

  // Narrowed above, but a closure does not keep that, so hold it in a local.
  const buying = piece;
  const inStock = buying.stockQty > 0;

  async function onAdd() {
    const ok = await addToCart(buying.id, 1);
    if (ok) setJustAdded(buying.id);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" aria-live="polite">
        {!inStock ? (
          <span className="text-muted-foreground">Sold out</span>
        ) : buying.stockQty <= SCARCITY_THRESHOLD ? (
          <span className="font-medium text-amber-700 dark:text-amber-500">
            Only {buying.stockQty} left
          </span>
        ) : (
          <span className="text-muted-foreground">In stock</span>
        )}
        <span className="text-muted-foreground"> · {formatInr(buying.price)}</span>
      </p>

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
          disabled={!inStock || isAdding}
          onClick={() => void onAdd()}
        >
          {isAdding ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Adding…
            </>
          ) : flashing ? (
            <>
              <Check className="size-4" aria-hidden />
              Added to bag
            </>
          ) : !inStock ? (
            "Sold out"
          ) : (
            "Add to bag"
          )}
        </Button>

        {/* The heart works whether or not the piece is in stock: saving
            something for later does not depend on it being available now. */}
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
