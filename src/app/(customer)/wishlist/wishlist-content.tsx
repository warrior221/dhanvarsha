"use client";

import { Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Price } from "@/components/shared/price";
import { EmptyState } from "@/components/shared/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { WishlistProductView } from "@/lib/queries/product";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";

export function WishlistContent() {
  const wishlist = useWishlistStore((state) => state.wishlist);
  const hydrated = useWishlistStore((state) => state.hydrated);
  const error = useWishlistStore((state) => state.error);
  const dismissError = useWishlistStore((state) => state.dismissError);

  if (!hydrated) {
    return (
      <div
        className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 xl:grid-cols-4"
        aria-busy="true"
      >
        <span className="sr-only">Loading saved items…</span>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[2/3] w-full rounded-lg" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (wishlist.products.length === 0) {
    return (
      <EmptyState
        title="Nothing saved yet"
        description="Tap the heart on any product to keep it here for later."
        action={
          <Button asChild>
            <Link href="/products">Browse the collection</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex items-start justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={dismissError}
              className="shrink-0 underline underline-offset-4"
            >
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 xl:grid-cols-4">
        {wishlist.products.map((product) => (
          <WishlistCard key={product.id} product={product} />
        ))}
      </ul>
    </div>
  );
}

function WishlistCard({ product }: { product: WishlistProductView }) {
  const removeFromWishlist = useWishlistStore((state) => state.remove);
  const isRemoving = useWishlistStore((state) => state.pending[product.id] ?? false);

  const addToCart = useCartStore((state) => state.add);
  const cartPending = useCartStore((state) => state.pending);

  const inStock = product.variants.filter((variant) => variant.stockQty > 0);

  // With one option we can move it straight to the bag. With several, the
  // shopper has to pick a size, so send them to the product page instead of
  // guessing one for them.
  const onlyOption = inStock.length === 1 ? inStock[0]! : null;
  const isAdding = onlyOption ? (cartPending[onlyOption.id] ?? false) : false;

  return (
    <li className="group flex flex-col">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
          {product.image ? (
            <Image
              src={product.image.url}
              alt={product.image.altText}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : null}
          {inStock.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <span className="rounded-full bg-background px-3 py-1 text-xs font-medium">
                Sold out
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-3 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {product.category.name}
          </p>
          <h2 className="line-clamp-2 text-sm font-medium group-hover:underline">
            {product.name}
          </h2>
          <Price mrp={product.mrp} sellingPrice={product.sellingPrice} />
        </div>
      </Link>

      <div className="mt-3 flex gap-2">
        {inStock.length === 0 ? (
          <Button variant="outline" size="sm" className="flex-1" disabled>
            Sold out
          </Button>
        ) : onlyOption ? (
          <Button
            type="button"
            size="sm"
            className="flex-1"
            disabled={isAdding}
            onClick={() => void addToCart(onlyOption.id, 1)}
          >
            {isAdding ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Adding…
              </>
            ) : (
              "Move to bag"
            )}
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link href={`/products/${product.slug}`}>Choose size</Link>
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground"
          disabled={isRemoving}
          aria-label={`Remove ${product.name} from wishlist`}
          onClick={() => void removeFromWishlist(product.id)}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}
