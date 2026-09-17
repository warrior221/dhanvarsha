import { formatInr } from "@/lib/format";
import type { WishlistProductView } from "@/lib/queries/product";

/**
 * Cart and wishlist view types plus their empty constants — NO database
 * import, so client components can use them.
 *
 * Same split as @/lib/catalog vs @/lib/queries/catalog: importing a VALUE
 * (like EMPTY_CART) from the query module would drag Prisma and the pg driver
 * into the browser bundle.
 */

export type CartItemView = {
  variantId: string;
  quantity: number;
  size: string | null;
  stockQty: number;
  unitPrice: string;
  lineTotal: string;
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    image: { url: string; altText: string } | null;
  };
};

export type CartView = {
  items: CartItemView[];
  /** Total number of units, for the navbar badge. */
  itemCount: number;
  subtotal: string;
  subtotalFormatted: string;
};

export const EMPTY_CART: CartView = {
  items: [],
  itemCount: 0,
  subtotal: "0.00",
  subtotalFormatted: formatInr("0.00"),
};

export type WishlistView = {
  products: WishlistProductView[];
  /** Product ids, so a product page can show the saved state cheaply. */
  productIds: string[];
};

export const EMPTY_WISHLIST: WishlistView = { products: [], productIds: [] };

/** 899900 -> "8999.00". Integer maths throughout, never float. */
export function paiseToDecimal(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
