import type { Metadata } from "next";
import { ReviewModeration } from "@/components/admin/review-moderation";
import { requireAdminPage } from "@/lib/auth-guards";
import {
  googleUnavailableReason,
  isGoogleReviewsConfigured,
} from "@/lib/google-places";
import { listShopReviewsForAdmin } from "@/lib/queries/shop-reviews";

export const metadata: Metadata = {
  title: "Reviews",
  robots: { index: false, follow: false },
};

export default async function AdminReviewsPage() {
  await requireAdminPage();

  const reviews = await listShopReviewsForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Reviews of the shop, shown as a moving strip on the home page. Ones
          written on the site wait here until you approve them.
        </p>
      </div>

      <ReviewModeration
        initial={reviews}
        googleAvailable={isGoogleReviewsConfigured()}
        googleReason={googleUnavailableReason()}
      />
    </div>
  );
}
