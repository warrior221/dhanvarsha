import { db } from "@/lib/db";

/**
 * Merges a guest's cart and wishlist into a real account, then removes the
 * guest rows (spec section 7).
 *
 * Merge rules:
 *   - same variant in both carts  -> quantities are summed
 *   - the sum is capped at the variant's available stock
 *   - wishlist duplicates are dropped rather than erroring
 *
 * Runs as one transaction so a failure part-way cannot leave the shopper with
 * a half-merged cart or a vanished one.
 */
export async function mergeGuestDataIntoUser(
  sessionId: string,
  userId: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    /* ---------------------------- cart ---------------------------- */
    const guestCart = await tx.cart.findUnique({
      where: { sessionId },
      include: {
        items: { include: { variant: { select: { id: true, stockQty: true } } } },
      },
    });

    if (guestCart && guestCart.items.length > 0) {
      const userCart = await tx.cart.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: { id: true },
      });

      for (const item of guestCart.items) {
        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_variantId: { cartId: userCart.id, variantId: item.variantId },
          },
          select: { quantity: true },
        });

        const combined = (existing?.quantity ?? 0) + item.quantity;
        // Never let a merge push the cart past what is actually in stock.
        const quantity = Math.max(1, Math.min(combined, item.variant.stockQty));

        // Out of stock entirely: drop the line rather than carry a zero.
        if (item.variant.stockQty <= 0) continue;

        await tx.cartItem.upsert({
          where: {
            cartId_variantId: { cartId: userCart.id, variantId: item.variantId },
          },
          update: { quantity },
          create: { cartId: userCart.id, variantId: item.variantId, quantity },
        });
      }
    }

    // Removing the cart cascades to its items.
    if (guestCart) {
      await tx.cart.delete({ where: { id: guestCart.id } });
    }

    /* -------------------------- wishlist -------------------------- */
    const guestWishlist = await tx.wishlist.findMany({
      where: { sessionId },
      select: { id: true, productId: true },
    });

    if (guestWishlist.length > 0) {
      const alreadySaved = await tx.wishlist.findMany({
        where: {
          userId,
          productId: { in: guestWishlist.map((row) => row.productId) },
        },
        select: { productId: true },
      });

      const savedIds = new Set(alreadySaved.map((row) => row.productId));
      const toCreate = guestWishlist.filter((row) => !savedIds.has(row.productId));

      if (toCreate.length > 0) {
        await tx.wishlist.createMany({
          data: toCreate.map((row) => ({ userId, productId: row.productId })),
          skipDuplicates: true,
        });
      }

      await tx.wishlist.deleteMany({ where: { sessionId } });
    }
  });
}
