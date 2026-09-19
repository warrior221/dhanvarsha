"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/store/cart-store";

/**
 * Live subtotal. Recomputed by the server on every change, so it cannot drift
 * away from what will actually be charged.
 *
 * Only the subtotal appears here; delivery depends on the address and payment
 * method, so it is worked out at checkout.
 */
export function CartSummary() {
  const cart = useCartStore((state) => state.cart);

  if (cart.items.length === 0) return null;

  return (
    <div className="space-y-3">
      <Separator />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Subtotal ({cart.itemCount} {cart.itemCount === 1 ? "item" : "items"})
        </p>
        <p className="text-lg font-semibold tabular-nums" aria-live="polite">
          {cart.subtotalFormatted}
        </p>
      </div>

      <Button asChild className="w-full" size="lg">
        <Link href="/checkout">Proceed to checkout</Link>
      </Button>

      <p className="text-xs text-muted-foreground">
        Delivery is calculated at checkout. Prices include GST.
      </p>
    </div>
  );
}
