import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { importGoogleReviews, listShopReviewsForAdmin } from "@/lib/queries/shop-reviews";

const ROUTE = "POST /api/admin/shop-reviews/import";

/** Pulls the shop's Google reviews in. Safe to run repeatedly. */
export async function POST() {
  try {
    await requireAdmin();

    const result = await importGoogleReviews();

    return apiSuccess({ ...result, reviews: await listShopReviewsForAdmin() });
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
