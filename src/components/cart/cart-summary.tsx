"use client";

import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/store/cart-store";

/**
 * Live subtotal. Recomputed by the server on every change, so it cannot drift
 * away from what will actually be charged.
 *
 * There is no "Proceed to checkout" button yet: /checkout is Phase 6, and a
 * button that leads to a 404 is worse than no button. Shipping and tax are
 * calculated at checkout too, which is why only the subtotal appears here.
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

      <p className="text-xs text-muted-foreground">
        Shipping and taxes are calculated at checkout, which arrives in the next
        build phase.
      </p>
    </div>
  );
}
