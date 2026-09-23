import { Star } from "lucide-react";
import type { Metadata } from "next";
import { ReviewForm } from "@/components/shop/review-form";
import { getOptionalUser } from "@/lib/auth-guards";
import { getPublishedShopReviews } from "@/lib/queries/shop-reviews";
import { relativeMonth } from "@/lib/shop-reviews";

export const metadata: Metadata = {
  title: "Customer reviews",
  description: "What customers say about shopping at Dhanvarsha.",
};

export default async function ReviewsPage() {
  const [user, { reviews, average, count }] = await Promise.all([
    getOptionalUser(),
    getPublishedShopReviews(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Customer reviews</h1>

      {average !== null ? (
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{average.toFixed(1)}</span> out
          of 5 from {count} {count === 1 ? "review" : "reviews"}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          No reviews yet. Yours would be the first.
        </p>
      )}

      <section className="mt-8 rounded-lg border bg-background p-5">
        <h2 className="mb-4 text-lg font-medium">Leave a review</h2>
        <ReviewForm defaultName={user?.name ?? null} isSignedIn={Boolean(user)} />
      </section>

      {reviews.length > 0 ? (
        <ul className="mt-8 space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-lg border bg-background p-5">
              <p className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    aria-hidden
                    className={
                      n <= review.rating
                        ? "size-4 fill-amber-400 text-amber-400"
                        : "size-4 fill-muted text-muted-foreground/40"
                    }
                  />
                ))}
              </p>

              <p className="mt-3 text-sm">{review.body}</p>

              <p className="mt-3 text-xs text-muted-foreground">
                {review.authorName} · {relativeMonth(review.reviewedAt)}
                {review.source === "GOOGLE" ? " · on Google" : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
