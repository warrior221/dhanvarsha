import type { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { EMPTY_CART } from "@/lib/cart";
import {
  addToCart,
  getCart,
  removeFromCart,
  setCartQuantity,
} from "@/lib/queries/cart";
import { resolveShopper } from "@/lib/shopper";
import {
  addToCartSchema,
  removeFromCartSchema,
  updateCartSchema,
} from "@/lib/validations/cart";

/**
 * The cart lives on the server (spec 12). The client store mirrors whatever
 * these handlers return; it is never the source of truth.
 *
 * Guests are supported: a mutation mints the guest cookie if there is not one
 * yet, while a read never does — a GET must not write.
 */

export async function GET() {
  try {
    const shopper = await resolveShopper();

    // No account and no guest cookie yet: nothing can exist to return.
    if (!shopper) return apiSuccess(EMPTY_CART);

    return apiSuccess(await getCart(shopper));
  } catch (error) {
    return handleApiError(error, "GET /api/cart");
  }
}

export async function POST(request: NextRequest) {
  try {
    const shopper = await resolveShopper({ create: true });
    const body: unknown = await request.json();
    const { variantId, quantity } = addToCartSchema.parse(body);

    return apiSuccess(await addToCart(shopper, variantId, quantity));
  } catch (error) {
    return handleApiError(error, "POST /api/cart");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const shopper = await resolveShopper();
    const body: unknown = await request.json();
    const { variantId, quantity } = updateCartSchema.parse(body);

    if (!shopper) return apiSuccess(EMPTY_CART);

    return apiSuccess(await setCartQuantity(shopper, variantId, quantity));
  } catch (error) {
    return handleApiError(error, "PATCH /api/cart");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const shopper = await resolveShopper();
    const body: unknown = await request.json();
    const { variantId } = removeFromCartSchema.parse(body);

    if (!shopper) return apiSuccess(EMPTY_CART);

    return apiSuccess(await removeFromCart(shopper, variantId));
  } catch (error) {
    return handleApiError(error, "DELETE /api/cart");
  }
}
