/**
 * Importing the shop's Google reviews.
 *
 * SERVER ONLY. Needs a Google Cloud project with the Places API enabled and
 * billing switched on, plus the shop's Place ID. Until GOOGLE_PLACES_API_KEY
 * and GOOGLE_PLACE_ID are set, isGoogleReviewsConfigured() is false and the
 * import button says so rather than failing mysteriously.
 *
 * THINGS GOOGLE IMPOSES, not choices made here:
 *   - at most FIVE reviews come back, and you cannot ask for more
 *   - which five is Google's decision, not ours
 *   - the reviewer's name, photo and link must be shown with the review
 *   - Google's terms limit how long their content may be stored, so these
 *     are re-imported rather than kept forever
 */

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places";
const TIMEOUT_MS = 6_000;

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
const placeId = process.env.GOOGLE_PLACE_ID;

export function isGoogleReviewsConfigured(): boolean {
  return Boolean(apiKey && placeId);
}

export function googleUnavailableReason(): string | null {
  if (isGoogleReviewsConfigured()) return null;

  return "Connect a Google Cloud project with the Places API and add your Place ID to import reviews.";
}

export type GoogleReview = {
  externalId: string;
  authorName: string;
  rating: number;
  body: string;
  authorPhotoUrl: string | null;
  authorUrl: string | null;
  reviewedAt: Date;
};

type PlacesReply = {
  rating?: number;
  userRatingCount?: number;
  reviews?: {
    name?: string;
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    publishTime?: string;
    authorAttribution?: {
      displayName?: string;
      photoUri?: string;
      uri?: string;
    };
  }[];
};

export type GoogleReviewsResult = {
  reviews: GoogleReview[];
  /** The shop's overall Google rating, if Google returned one. */
  rating: number | null;
  totalRatings: number | null;
};

/** Fetches the shop's listing. Throws with a readable message on failure. */
export async function fetchGoogleReviews(): Promise<GoogleReviewsResult> {
  if (!isGoogleReviewsConfigured()) {
    throw new Error("Google reviews are not configured.");
  }

  const response = await fetch(`${PLACES_ENDPOINT}/${placeId}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "X-Goog-Api-Key": apiKey!,
      "X-Goog-FieldMask": "reviews,rating,userRatingCount",
    },
  });

  if (!response.ok) {
    // Google's body can echo the API key back; never surface or log it.
    throw new Error(
      response.status === 403
        ? "Google refused the request. Check the API key, that the Places API is enabled, and that billing is on."
        : response.status === 404
          ? "Google does not recognise that Place ID."
          : `Google returned status ${response.status}.`,
    );
  }

  const body = (await response.json()) as PlacesReply;

  const reviews: GoogleReview[] = [];

  for (const review of body.reviews ?? []) {
    const text = review.text?.text ?? review.originalText?.text ?? "";
    const name = review.authorAttribution?.displayName;
    const rating = review.rating;

    // A review with no id cannot be de-duplicated on re-import, and one with
    // no text is an empty card on the home page. Skip both.
    if (!review.name || !name || !text.trim() || !rating) continue;

    reviews.push({
      externalId: review.name,
      authorName: name,
      rating: Math.round(rating),
      body: text.trim(),
      authorPhotoUrl: review.authorAttribution?.photoUri ?? null,
      authorUrl: review.authorAttribution?.uri ?? null,
      reviewedAt: review.publishTime ? new Date(review.publishTime) : new Date(),
    });
  }

  return {
    reviews,
    rating: body.rating ?? null,
    totalRatings: body.userRatingCount ?? null,
  };
}
