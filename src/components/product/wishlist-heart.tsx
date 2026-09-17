"use client";

import { Heart } from "lucide-react";
import { useWishlistStore } from "@/store/wishlist-store";
import { cn } from "@/lib/utils";

/**
 * Save toggle overlaid on a product tile. Sits inside the card's link, so it
 * stops propagation — tapping the heart must not navigate to the product.
 */
export function WishlistHeart({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const toggle = useWishlistStore((state) => state.toggle);
  const saved = useWishlistStore((state) => state.wishlist.productIds.includes(productId));
  const isPending = useWishlistStore((state) => state.pending[productId] ?? false);

  return (
    <button
      type="button"
      disabled={isPending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggle(productId);
      }}
      className={cn(
        "absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full",
        "bg-background/80 backdrop-blur transition hover:bg-background",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        isPending && "opacity-60",
      )}
    >
      <Heart
        className={cn("size-4", saved ? "fill-current text-rose-600" : "text-foreground")}
        aria-hidden
      />
    </button>
  );
}
