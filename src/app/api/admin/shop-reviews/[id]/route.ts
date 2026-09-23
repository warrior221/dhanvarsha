import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import {
  deleteShopReview,
  listShopReviewsForAdmin,
  setShopReviewPublished,
} from "@/lib/queries/shop-reviews";

const ROUTE = "/api/admin/shop-reviews/[id]";

const bodySchema = z.object({ isPublished: z.boolean() });

/** Show or hide one review. */
export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/admin/shop-reviews/[id]">,
) {
  try {
    await requireAdmin();

    // params is a Promise in Next.js 16.
    const { id } = await context.params;
    const { isPublished } = bodySchema.parse(await request.json());

    await setShopReviewPublished(id, isPublished);

    return apiSuccess({ reviews: await listShopReviewsForAdmin() });
  } catch (error) {
    return handleApiError(error, `PATCH ${ROUTE}`);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/admin/shop-reviews/[id]">,
) {
  try {
    await requireAdmin();

    const { id } = await context.params;
    await deleteShopReview(id);

    return apiSuccess({ reviews: await listShopReviewsForAdmin() });
  } catch (error) {
    return handleApiError(error, `DELETE ${ROUTE}`);
  }
}
