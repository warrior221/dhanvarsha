import type { ShopReviewSource } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { fetchGoogleReviews, isGoogleReviewsConfigured } from "@/lib/google-places";
import {
  MAX_BODY_LENGTH,
  type ShopReviewView,
  averageRating,
  isValidRating,
} from "@/lib/shop-reviews";

/**
 * Reviews OF THE SHOP, shown as a moving strip on the home page.
 *
 * Two sources: written here, or imported from the shop's Google listing.
 * Google's are already public on Google, so they publish on import. Ones
 * written here wait for an admin — the home page is the first thing a
 * stranger sees, and a text box wired straight onto it is an invitation.
 */

/** How many to feed the strip. Enough to look alive, not enough to crawl. */
const MARQUEE_LIMIT = 20;

export type ShopReviewSummary = {
  reviews: ShopReviewView[];
  average: number | null;
  count: number;
};

export async function getPublishedShopReviews(): Promise<ShopReviewSummary> {
  const rows = await db.shopReview.findMany({
    where: { isPublished: true },
    orderBy: { reviewedAt: "desc" },
    take: MARQUEE_LIMIT,
    select: {
      id: true,
      authorName: true,
      rating: true,
      body: true,
      source: true,
      authorPhotoUrl: true,
      authorUrl: true,
      reviewedAt: true,
    },
  });

  const [aggregate, count] = await Promise.all([
    db.shopReview.aggregate({ where: { isPublished: true }, _avg: { rating: true } }),
    db.shopReview.count({ where: { isPublished: true } }),
  ]);

  return {
    reviews: rows.map(toView),
    // Averaged across EVERY published review, not just the twenty on screen.
    average:
      aggregate._avg.rating === null
        ? null
        : Math.round(aggregate._avg.rating * 10) / 10,
    count,
  };
}

function toView(row: {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  source: ShopReviewSource;
  authorPhotoUrl: string | null;
  authorUrl: string | null;
  reviewedAt: Date;
}): ShopReviewView {
  return {
    id: row.id,
    authorName: row.authorName,
    rating: row.rating,
    body: row.body,
    source: row.source,
    authorPhotoUrl: row.authorPhotoUrl,
    authorUrl: row.authorUrl,
    reviewedAt: row.reviewedAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Writing one                                                         */
/* ------------------------------------------------------------------ */

export type SubmitReviewInput = {
  authorName: string;
  rating: number;
  body: string;
  /**
   * Required. Reviews are account-only: a guest review is unattributable,
   * cannot be limited to one per person, and is the easy way to fill a
   * home page with praise nobody wrote.
   */
  userId: string;
};

export async function submitShopReview(input: SubmitReviewInput): Promise<void> {
  if (!isValidRating(input.rating)) {
    throw new AppError("BAD_RATING", "Choose between one and five stars.", 400);
  }

  const body = input.body.trim();

  if (body.length < 4) {
    throw new AppError("BAD_REVIEW", "Tell us a little about your experience.", 400);
  }

  // One per account. A strip of ten reviews from the same person is worse
  // than no strip at all.
  const existing = await db.shopReview.findFirst({
    where: { userId: input.userId },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(
      "ALREADY_REVIEWED",
      "You have already left a review — thank you.",
      409,
    );
  }

  await db.shopReview.create({
    data: {
      source: "WEBSITE",
      authorName: input.authorName.trim().slice(0, 80),
      rating: input.rating,
      body: body.slice(0, MAX_BODY_LENGTH),
      userId: input.userId,
      reviewedAt: new Date(),
      // Waits for an admin.
      isPublished: false,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export type AdminShopReview = ShopReviewView & {
  isPublished: boolean;
  customerEmail: string | null;
};

export async function listShopReviewsForAdmin(): Promise<AdminShopReview[]> {
  const rows = await db.shopReview.findMany({
    orderBy: [{ isPublished: "asc" }, { reviewedAt: "desc" }],
    select: {
      id: true,
      authorName: true,
      rating: true,
      body: true,
      source: true,
      authorPhotoUrl: true,
      authorUrl: true,
      reviewedAt: true,
      isPublished: true,
      user: { select: { email: true } },
    },
  });

  return rows.map((row) => ({
    ...toView(row),
    isPublished: row.isPublished,
    customerEmail: row.user?.email ?? null,
  }));
}

export async function setShopReviewPublished(
  id: string,
  isPublished: boolean,
): Promise<void> {
  const updated = await db.shopReview.updateMany({
    where: { id },
    data: { isPublished },
  });

  if (updated.count === 0) {
    throw new AppError("REVIEW_NOT_FOUND", "That review no longer exists.", 404);
  }
}

export async function deleteShopReview(id: string): Promise<void> {
  const deleted = await db.shopReview.deleteMany({ where: { id } });

  if (deleted.count === 0) {
    throw new AppError("REVIEW_NOT_FOUND", "That review no longer exists.", 404);
  }
}

/* ------------------------------------------------------------------ */
/* Google import                                                       */
/* ------------------------------------------------------------------ */

export type ImportResult = { added: number; updated: number; total: number };

/**
 * Pulls the shop's Google reviews in.
 *
 * Matched on Google's own review id, so running it again updates the same
 * rows instead of stacking duplicates on the home page. An admin who has
 * deliberately hidden one keeps it hidden: a re-import must not quietly undo
 * a moderation decision.
 */
export async function importGoogleReviews(): Promise<ImportResult> {
  if (!isGoogleReviewsConfigured()) {
    throw new AppError(
      "GOOGLE_NOT_CONFIGURED",
      "Google reviews are not connected yet.",
      400,
    );
  }

  let fetched;

  try {
    fetched = await fetchGoogleReviews();
  } catch (error) {
    throw new AppError(
      "GOOGLE_FAILED",
      error instanceof Error ? error.message : "Could not reach Google.",
      502,
    );
  }

  let added = 0;
  let updated = 0;

  for (const review of fetched.reviews) {
    const existing = await db.shopReview.findUnique({
      where: { externalId: review.externalId },
      select: { id: true },
    });

    if (existing) {
      await db.shopReview.update({
        where: { externalId: review.externalId },
        data: {
          authorName: review.authorName,
          rating: review.rating,
          body: review.body,
          authorPhotoUrl: review.authorPhotoUrl,
          authorUrl: review.authorUrl,
          reviewedAt: review.reviewedAt,
          // isPublished deliberately untouched.
        },
      });
      updated += 1;
    } else {
      await db.shopReview.create({
        data: {
          source: "GOOGLE",
          externalId: review.externalId,
          authorName: review.authorName,
          rating: review.rating,
          body: review.body,
          authorPhotoUrl: review.authorPhotoUrl,
          authorUrl: review.authorUrl,
          reviewedAt: review.reviewedAt,
          // Already public on Google, so nothing to moderate before showing.
          isPublished: true,
        },
      });
      added += 1;
    }
  }

  return { added, updated, total: fetched.reviews.length };
}

/** Used by the home page to decide whether to render the strip at all. */
export async function hasPublishedReviews(): Promise<boolean> {
  return (await db.shopReview.count({ where: { isPublished: true } })) > 0;
}

export { averageRating };
