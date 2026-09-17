import { z } from "zod";

/**
 * Shared by the client components and the API routes. The server is the one
 * that counts — the client copy only gives faster feedback.
 */

/** Prisma cuids. Kept loose; the database lookup is the real check. */
const idSchema = z.string().trim().min(1).max(64);

/** A sane upper bound so one request cannot ask for 10,000 sarees. */
const MAX_QUANTITY = 50;

export const addToCartSchema = z.object({
  variantId: idSchema,
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(MAX_QUANTITY, `You can order at most ${MAX_QUANTITY} of one item.`)
    .default(1),
});

export const updateCartSchema = z.object({
  variantId: idSchema,
  /** Zero removes the line. */
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(0)
    .max(MAX_QUANTITY, `You can order at most ${MAX_QUANTITY} of one item.`),
});

export const removeFromCartSchema = z.object({
  variantId: idSchema,
});

export const wishlistItemSchema = z.object({
  productId: idSchema,
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartInput = z.infer<typeof updateCartSchema>;
export type WishlistItemInput = z.infer<typeof wishlistItemSchema>;
