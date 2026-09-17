"use client";

import Link from "next/link";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { CartSummary } from "@/components/cart/cart-summary";
import { EmptyState } from "@/components/shared/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCartStore } from "@/store/cart-store";

export function CartContent() {
  const cart = useCartStore((state) => state.cart);
  const hydrated = useCartStore((state) => state.hydrated);
  const error = useCartStore((state) => state.error);
  const dismissError = useCartStore((state) => state.dismissError);

  // The layout seeds the store on mount, so this is brief — but without it the
  // page would flash "your bag is empty" at someone whose bag is not.
  if (!hydrated) {
    return (
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only">Loading your bag…</span>
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex gap-3 py-4">
            <Skeleton className="aspect-[2/3] w-20 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <EmptyState
        title="Your bag is empty"
        description="Once you add something it will stay here, even if you close the tab."
        action={
          <Button asChild>
            <Link href="/products">Start shopping</Link>
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

      <ul className="divide-y border-y">
        {cart.items.map((item) => (
          <CartLineItem key={item.variantId} item={item} />
        ))}
      </ul>

      <div className="ml-auto max-w-sm">
        <CartSummary />
      </div>
    </div>
  );
}
