import type { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { EMPTY_WISHLIST } from "@/lib/cart";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from "@/lib/queries/wishlist";
import { resolveShopper } from "@/lib/shopper";
import { wishlistItemSchema } from "@/lib/validations/cart";

/** Same shape as the cart: server-persisted, guest-capable, read never writes. */

export async function GET() {
  try {
    const shopper = await resolveShopper();

    if (!shopper) return apiSuccess(EMPTY_WISHLIST);

    return apiSuccess(await getWishlist(shopper));
  } catch (error) {
    return handleApiError(error, "GET /api/wishlist");
  }
}

export async function POST(request: NextRequest) {
  try {
    const shopper = await resolveShopper({ create: true });
    const body: unknown = await request.json();
    const { productId } = wishlistItemSchema.parse(body);

    return apiSuccess(await addToWishlist(shopper, productId));
  } catch (error) {
    return handleApiError(error, "POST /api/wishlist");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const shopper = await resolveShopper();
    const body: unknown = await request.json();
    const { productId } = wishlistItemSchema.parse(body);

    if (!shopper) return apiSuccess(EMPTY_WISHLIST);

    return apiSuccess(await removeFromWishlist(shopper, productId));
  } catch (error) {
    return handleApiError(error, "DELETE /api/wishlist");
  }
}
