"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import type { ShopReviewView } from "@/lib/shop-reviews";
import { relativeMonth } from "@/lib/shop-reviews";
import { cn } from "@/lib/utils";

/**
 * Customer reviews, drifting right to left across the home page.
 *
 * THE MOTION IS OPTIONAL, on purpose:
 *   - it pauses while the pointer is over it, so a review can be read
 *   - it pauses on keyboard focus, so it can be tabbed through
 *   - `prefers-reduced-motion` turns it off entirely and leaves a strip the
 *     visitor scrolls themselves — moving text is a genuine problem for some
 *     people, and a shop cannot know who is looking
 *
 * The list is rendered twice. The animation shifts by exactly half the total
 * width, so the second copy is where the first was when it restarts and the
 * loop has no visible seam.
 */
export function ReviewMarquee({ reviews }: { reviews: ShopReviewView[] }) {
  const [paused, setPaused] = useState(false);

  if (reviews.length === 0) return null;

  // Slower with more cards, so the speed past the eye stays the same however
  // many reviews the shop has.
  const durationSeconds = Math.max(30, reviews.length * 7);

  return (
    <div
      className="group relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Faded edges, so cards enter and leave rather than being cut off. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent"
      />

      <ul
        className={cn(
          "flex w-max gap-4 motion-safe:animate-[marquee_var(--marquee-duration)_linear_infinite]",
          // Without motion-safe this would still scroll for people who have
          // asked their device for less movement.
          "motion-reduce:overflow-x-auto motion-reduce:w-full",
          paused && "[animation-play-state:paused]",
        )}
        style={{ "--marquee-duration": `${durationSeconds}s` } as React.CSSProperties}
      >
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}

        {/* The seamless second lap. Hidden from screen readers so every
            review is not announced twice. */}
        {reviews.map((review) => (
          <ReviewCard key={`echo-${review.id}`} review={review} ariaHidden />
        ))}
      </ul>
    </div>
  );
}

function ReviewCard({
  review,
  ariaHidden,
}: {
  review: ShopReviewView;
  ariaHidden?: boolean;
}) {
  return (
    <li
      aria-hidden={ariaHidden}
      className="w-[85vw] max-w-80 shrink-0 rounded-lg border bg-background p-5"
    >
      <Stars rating={review.rating} />

      <p className="mt-3 line-clamp-4 text-sm text-foreground/90">
        &ldquo;{review.body}&rdquo;
      </p>

      <div className="mt-4 flex items-center gap-2">
        {review.authorPhotoUrl ? (
          // Google supplies these on their own domains; a plain img avoids
          // having to allow-list every one of them for next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.authorPhotoUrl}
            alt=""
            width={28}
            height={28}
            loading="lazy"
            className="size-7 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium"
          >
            {review.authorName.slice(0, 1).toUpperCase()}
          </span>
        )}

        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{review.authorName}</p>
          <p className="text-xs text-muted-foreground">
            {relativeMonth(review.reviewedAt)}
            {review.source === "GOOGLE" ? (
              <>
                {" · "}
                {/* Google requires their reviews to be attributed. */}
                {review.authorUrl ? (
                  <a
                    href={review.authorUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    on Google
                  </a>
                ) : (
                  "on Google"
                )}
              </>
            ) : null}
          </p>
        </div>
      </div>
    </li>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <p className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn(
            "size-4",
            n <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted-foreground/40",
          )}
        />
      ))}
    </p>
  );
}
