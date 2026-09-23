"use client";

import { Download, Eye, EyeOff, Loader2, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, requestJson } from "@/lib/api-client";
import type { AdminShopReview } from "@/lib/queries/shop-reviews";
import { relativeMonth } from "@/lib/shop-reviews";
import { cn } from "@/lib/utils";

/**
 * Approving, hiding and importing shop reviews.
 *
 * Reviews written on the site arrive hidden and are listed first, because
 * they are the ones waiting on a decision.
 */
export function ReviewModeration({
  initial,
  googleAvailable,
  googleReason,
}: {
  initial: AdminShopReview[];
  googleAvailable: boolean;
  googleReason: string | null;
}) {
  const [reviews, setReviews] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const waiting = reviews.filter((review) => !review.isPublished).length;

  async function setPublished(review: AdminShopReview, isPublished: boolean) {
    setBusyId(review.id);
    setError(null);

    try {
      const result = await requestJson<{ reviews: AdminShopReview[] }>(
        `/api/admin/shop-reviews/${review.id}`,
        "PATCH",
        { isPublished },
      );
      setReviews(result.reviews);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update that.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(review: AdminShopReview) {
    setBusyId(review.id);
    setError(null);

    try {
      const result = await requestJson<{ reviews: AdminShopReview[] }>(
        `/api/admin/shop-reviews/${review.id}`,
        "DELETE",
      );
      setReviews(result.reviews);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that.");
    } finally {
      setBusyId(null);
    }
  }

  async function importFromGoogle() {
    setImporting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await requestJson<{
        added: number;
        updated: number;
        total: number;
        reviews: AdminShopReview[];
      }>("/api/admin/shop-reviews/import", "POST");

      setReviews(result.reviews);
      setNotice(
        result.total === 0
          ? "Google returned no reviews for that listing yet."
          : `${result.added} new, ${result.updated} refreshed. Google only ever returns five.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach Google.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {waiting > 0
            ? `${waiting} waiting for your approval`
            : "Nothing waiting for approval"}
        </p>

        <Button
          type="button"
          variant="outline"
          disabled={!googleAvailable || importing}
          onClick={() => void importFromGoogle()}
        >
          {importing ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Importing…
            </>
          ) : (
            <>
              <Download className="size-4" aria-hidden />
              Import from Google
            </>
          )}
        </Button>
      </div>

      {!googleAvailable && googleReason ? (
        <Alert role="status">
          <AlertDescription>{googleReason}</AlertDescription>
        </Alert>
      ) : null}

      {notice ? (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {reviews.length === 0 ? (
        <p className="rounded-md bg-muted p-4 text-sm">
          No reviews yet. They will appear here as customers write them, or when
          you import from Google.
        </p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className={cn(
                "rounded-lg border bg-background p-4",
                !review.isPublished && "border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/10",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className="flex gap-0.5" aria-label={`${review.rating} of 5`}>
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
                    </span>
                    <span className="text-sm font-medium">{review.authorName}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {review.source === "GOOGLE" ? "Google" : "Website"}
                    </span>
                    {!review.isPublished ? (
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-500">
                        Waiting
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-2 text-sm">{review.body}</p>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {relativeMonth(review.reviewedAt)}
                    {review.customerEmail ? ` · ${review.customerEmail}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant={review.isPublished ? "ghost" : "default"}
                    size="sm"
                    disabled={busyId === review.id}
                    onClick={() => void setPublished(review, !review.isPublished)}
                  >
                    {review.isPublished ? (
                      <>
                        <EyeOff className="size-4" aria-hidden />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="size-4" aria-hidden />
                        Show it
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete review by ${review.authorName}`}
                    className="text-destructive hover:text-destructive"
                    disabled={busyId === review.id}
                    onClick={() => void remove(review)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
