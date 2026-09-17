import {
  EMPTY_CART,
  paiseToDecimal,
  type CartItemView,
  type CartView,
} from "@/lib/cart";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { formatInr, toPaise } from "@/lib/format";
import type { Shopper } from "@/lib/shopper";

/**
 * Cart persistence. The DATABASE is the source of truth (spec 12) — the
 * Zustand store on the client only mirrors whatever these functions return.
 *
 * Stock is re-checked on every mutation, because the shopper's copy of the
 * stock number is always potentially stale.
 */

function ownerWhere(owner: Shopper) {
  return owner.kind === "user"
    ? { userId: owner.userId }
    : { sessionId: owner.sessionId };
}

const cartItemInclude = {
  variant: {
    select: {
      id: true,
      size: true,
      price: true,
      stockQty: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          isActive: true,
          images: { select: { url: true, altText: true }, orderBy: { position: "asc" }, take: 1 },
        },
      },
    },
  },
} as const;

/** Reads the cart without creating one. A GET must not write. */
export async function getCart(owner: Shopper): Promise<CartView> {
  const cart = await db.cart.findUnique({
    where: ownerWhere(owner),
    select: { items: { include: cartItemInclude, orderBy: { id: "asc" } } },
  });

  if (!cart) return EMPTY_CART;

  return toCartView(cart.items);
}

function toCartView(
  items: {
    quantity: number;
    variant: {
      id: string;
      size: string | null;
      price: { toString(): string };
      stockQty: number;
      product: {
        id: string;
        name: string;
        slug: string;
        sku: string;
        isActive: boolean;
        images: { url: string; altText: string }[];
      };
    };
  }[],
): CartView {
  // A product deactivated after it was added should not linger in the cart.
  const live = items.filter((item) => item.variant.product.isActive);

  let subtotalPaise = 0;
  let itemCount = 0;

  const views: CartItemView[] = live.map((item) => {
    const unitPaise = toPaise(item.variant.price.toString());
    const linePaise = unitPaise * item.quantity;

    subtotalPaise += linePaise;
    itemCount += item.quantity;

    return {
      variantId: item.variant.id,
      quantity: item.quantity,
      size: item.variant.size,
      stockQty: item.variant.stockQty,
      unitPrice: item.variant.price.toString(),
      lineTotal: paiseToDecimal(linePaise),
      product: {
        id: item.variant.product.id,
        name: item.variant.product.name,
        slug: item.variant.product.slug,
        sku: item.variant.product.sku,
        image: item.variant.product.images[0] ?? null,
      },
    };
  });

  const subtotal = paiseToDecimal(subtotalPaise);

  return {
    items: views,
    itemCount,
    subtotal,
    subtotalFormatted: formatInr(subtotal),
  };
}

async function getOrCreateCartId(owner: Shopper): Promise<string> {
  const existing = await db.cart.findUnique({
    where: ownerWhere(owner),
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await db.cart.create({
    data: owner.kind === "user" ? { userId: owner.userId } : { sessionId: owner.sessionId },
    select: { id: true },
  });

  return created.id;
}

async function requireSellableVariant(variantId: string) {
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      stockQty: true,
      product: { select: { isActive: true, name: true } },
    },
  });

  if (!variant || !variant.product.isActive) {
    throw new AppError("VARIANT_NOT_FOUND", "That item is no longer available.", 404);
  }

  return variant;
}

/**
 * Adds to the existing quantity rather than replacing it, so adding the same
 * size twice behaves the way a shopper expects.
 */
export async function addToCart(
  owner: Shopper,
  variantId: string,
  quantity: number,
): Promise<CartView> {
  const variant = await requireSellableVariant(variantId);

  if (variant.stockQty <= 0) {
    throw new AppError("OUT_OF_STOCK", "That size is out of stock.", 409);
  }

  const cartId = await getOrCreateCartId(owner);

  const existing = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId } },
    select: { quantity: true },
  });

  const desired = (existing?.quantity ?? 0) + quantity;

  if (desired > variant.stockQty) {
    throw new AppError(
      "INSUFFICIENT_STOCK",
      existing
        ? `Only ${variant.stockQty} in stock, and you already have ${existing.quantity} in your bag.`
        : `Only ${variant.stockQty} in stock.`,
      409,
    );
  }

  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    update: { quantity: desired },
    create: { cartId, variantId, quantity: desired },
  });

  return getCart(owner);
}

/** Sets an absolute quantity. Zero removes the line. */
export async function setCartQuantity(
  owner: Shopper,
  variantId: string,
  quantity: number,
): Promise<CartView> {
  if (quantity <= 0) return removeFromCart(owner, variantId);

  const variant = await requireSellableVariant(variantId);

  if (quantity > variant.stockQty) {
    throw new AppError(
      "INSUFFICIENT_STOCK",
      variant.stockQty > 0
        ? `Only ${variant.stockQty} in stock.`
        : "That size is out of stock.",
      409,
    );
  }

  const cart = await db.cart.findUnique({
    where: ownerWhere(owner),
    select: { id: true },
  });

  if (!cart) throw new AppError("CART_EMPTY", "Your bag is empty.", 404);

  // updateMany, so an item already removed in another tab is not a 500.
  const updated = await db.cartItem.updateMany({
    where: { cartId: cart.id, variantId },
    data: { quantity },
  });

  if (updated.count === 0) {
    throw new AppError("ITEM_NOT_IN_CART", "That item is not in your bag.", 404);
  }

  return getCart(owner);
}

export async function removeFromCart(
  owner: Shopper,
  variantId: string,
): Promise<CartView> {
  const cart = await db.cart.findUnique({
    where: ownerWhere(owner),
    select: { id: true },
  });

  if (cart) {
    await db.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
  }

  return getCart(owner);
}
