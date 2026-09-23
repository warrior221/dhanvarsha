/**
 * Shop reviews — the strip of customer voices on the home page.
 *
 * PURE MODULE — no database import, so the marquee and the review form can
 * both use these.
 */

export const MIN_RATING = 1;
export const MAX_RATING = 5;

/** Longer than this is a letter, not a review, and breaks the strip. */
export const MAX_BODY_LENGTH = 400;

export type ShopReviewView = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  /** "GOOGLE" reviews must carry their attribution. */
  source: "WEBSITE" | "GOOGLE";
  authorPhotoUrl: string | null;
  authorUrl: string | null;
  reviewedAt: string;
};

export function isValidRating(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_RATING && value <= MAX_RATING;
}

/**
 * Average, to one decimal. Null when there is nothing to average — a shop
 * with no reviews should say so rather than display "0.0 stars".
 */
export function averageRating(reviews: { rating: number }[]): number | null {
  if (reviews.length === 0) return null;

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);

  return Math.round((total / reviews.length) * 10) / 10;
}

/** "3 weeks ago" — reviews read as stale with an exact date on them. */
export function relativeMonth(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);

  if (days < 1) return "today";
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  if (days < 365) {
    const months = Math.max(1, Math.floor(days / 30));
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }

  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
