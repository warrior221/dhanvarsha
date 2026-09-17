"use client";

import { useEffect } from "react";
import type { CartView, WishlistView } from "@/lib/cart";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";

/**
 * Seeds the client stores with data the layout already fetched on the server,
 * so the cart badge and saved-state hearts render correctly on first paint
 * instead of flashing empty and then filling in.
 *
 * Renders nothing.
 */
export function StoreHydrator({
  cart,
  wishlist,
}: {
  cart: CartView;
  wishlist: WishlistView;
}) {
  const hydrateCart = useCartStore((state) => state.hydrate);
  const hydrateWishlist = useWishlistStore((state) => state.hydrate);

  useEffect(() => {
    hydrateCart(cart);
    hydrateWishlist(wishlist);
  }, [cart, wishlist, hydrateCart, hydrateWishlist]);

  return null;
}
