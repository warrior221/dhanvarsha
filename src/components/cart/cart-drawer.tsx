"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { CartSummary } from "@/components/cart/cart-summary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCartStore } from "@/store/cart-store";

/** Bag button with a live count, opening a slide-over of the cart. */
export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const cart = useCartStore((state) => state.cart);
  const hydrated = useCartStore((state) => state.hydrated);
  const error = useCartStore((state) => state.error);
  const dismissError = useCartStore((state) => state.dismissError);

  const count = cart.itemCount;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative"
          aria-label={
            hydrated && count > 0 ? `Bag, ${count} items` : "Bag, empty"
          }
        >
          <ShoppingBag className="size-4" aria-hidden />
          <span className="hidden sm:inline">Bag</span>
          {hydrated && count > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground tabular-nums">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your bag</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
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

          {cart.items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                Your bag is empty.
              </p>
              <Button asChild variant="outline" onClick={() => setOpen(false)}>
                <Link href="/products">Start shopping</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {cart.items.map((item) => (
                <CartLineItem
                  key={item.variantId}
                  item={item}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </ul>
          )}
        </div>

        {cart.items.length > 0 ? (
          <div className="space-y-4 border-t p-4">
            <CartSummary />
            <Button asChild variant="outline" className="w-full">
              <Link href="/cart" onClick={() => setOpen(false)}>
                View full bag
              </Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
