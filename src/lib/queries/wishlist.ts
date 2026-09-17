import { EMPTY_WISHLIST, type WishlistView } from "@/lib/cart";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  toWishlistProductView,
  wishlistProductSelect,
} from "@/lib/queries/product";
import type { Shopper } from "@/lib/shopper";

/**
 * Wishlist persistence. Like the cart, the database is the source of truth and
 * rows hang off either a userId or a guest sessionId.
 *
 * Postgres treats NULLs as distinct in a unique index, which is exactly why the
 * schema carries two separate constraints — [userId, productId] and
 * [sessionId, productId] — rather than one over both columns.
 */

function ownerWhere(shopper: Shopper) {
  return shopper.kind === "user"
    ? { userId: shopper.userId }
    : { sessionId: shopper.sessionId };
}

function uniqueWhere(shopper: Shopper, productId: string) {
  return shopper.kind === "user"
    ? { userId_productId: { userId: shopper.userId, productId } }
    : { sessionId_productId: { sessionId: shopper.sessionId, productId } };
}

export async function getWishlist(shopper: Shopper): Promise<WishlistView> {
  const rows = await db.wishlist.findMany({
    where: ownerWhere(shopper),
    orderBy: { createdAt: "desc" },
    select: { product: { select: wishlistProductSelect } },
  });

  const products = rows
    .filter((row) => row.product !== null)
    .map((row) => toWishlistProductView(row.product));

  return { products, productIds: products.map((product) => product.id) };
}

export async function addToWishlist(
  shopper: Shopper,
  productId: string,
): Promise<WishlistView> {
  const product = await db.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true },
  });

  if (!product) {
    throw new AppError("PRODUCT_NOT_FOUND", "That product is no longer available.", 404);
  }

  // Saving something already saved is a no-op, not an error.
  await db.wishlist.upsert({
    where: uniqueWhere(shopper, productId),
    update: {},
    create:
      shopper.kind === "user"
        ? { userId: shopper.userId, productId }
        : { sessionId: shopper.sessionId, productId },
  });

  return getWishlist(shopper);
}

export async function removeFromWishlist(
  shopper: Shopper,
  productId: string,
): Promise<WishlistView> {
  // deleteMany, so removing something already gone is not an error.
  await db.wishlist.deleteMany({
    where: { ...ownerWhere(shopper), productId },
  });

  return getWishlist(shopper);
}
