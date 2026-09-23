import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { submitShopReview } from "@/lib/queries/shop-reviews";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { MAX_BODY_LENGTH, MAX_RATING, MIN_RATING } from "@/lib/shop-reviews";

const ROUTE = "POST /api/shop-reviews";

const bodySchema = z.object({
  authorName: z.string().trim().min(2, "Enter your name.").max(80),
  rating: z.number().int().min(MIN_RATING).max(MAX_RATING),
  body: z
    .string()
    .trim()
    .min(4, "Tell us a little about your experience.")
    .max(MAX_BODY_LENGTH),
});

/**
 * Leaving a review of the shop.
 *
 * ACCOUNT REQUIRED. A guest review cannot be tied to anyone, cannot be held
 * to one per person, and is the easy way to fill a home page with praise
 * nobody wrote. Nothing appears until an admin approves it either way.
 */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit("shopReview", clientIpFrom(request.headers));

    const user = await requireUser();
    const input = bodySchema.parse(await request.json());

    await submitShopReview({
      authorName: input.authorName,
      rating: input.rating,
      body: input.body,
      userId: user.id,
    });

    return apiSuccess({ received: true }, 201);
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
