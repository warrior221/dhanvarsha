"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, postJson } from "@/lib/api-client";
import { MAX_BODY_LENGTH } from "@/lib/shop-reviews";
import { cn } from "@/lib/utils";

/**
 * Leaving a review of the shop.
 *
 * Signed-in customers only. A signed-out visitor is shown a sign-in link
 * rather than a form that collects their words and then refuses them — the
 * server enforces the rule either way, so this is only about not wasting
 * someone's time.
 *
 * The thank-you deliberately does not mention that a review is checked before
 * it goes up. It also does not claim the review is live, which would be
 * untrue — it simply thanks them and stops.
 */
export function ReviewForm({
  defaultName,
  isSignedIn,
}: {
  defaultName: string | null;
  isSignedIn: boolean;
}) {
  const [name, setName] = useState(defaultName ?? "");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating === 0) {
      setError("Choose a star rating.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await postJson("/api/shop-reviews", {
        authorName: name.trim(),
        rating,
        body: body.trim(),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send that review.");
    } finally {
      setBusy(false);
    }
  }

  if (!isSignedIn) {
    return (
      <div className="rounded-md bg-muted p-4 text-sm">
        <p className="font-medium">Sign in to leave a review</p>
        <p className="mt-1 text-muted-foreground">
          Reviews come from real customer accounts, so shoppers can trust what
          they read here.
        </p>
        <Link
          href="/login?callbackUrl=%2Freviews"
          className="mt-3 inline-block font-medium underline underline-offset-4"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <Alert role="status">
        <AlertDescription>
          <strong>Thank you.</strong> We appreciate you taking the time.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              aria-pressed={rating === value}
              className="rounded p-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => {
                setRating(value);
                setError(null);
              }}
            >
              <Star
                className={cn(
                  "size-7 transition",
                  value <= rating
                    ? "fill-amber-400 text-amber-400"
                    : "fill-muted text-muted-foreground/40 hover:text-amber-400",
                )}
                aria-hidden
              />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="review-name">Your name</Label>
        <Input
          id="review-name"
          value={name}
          maxLength={80}
          placeholder="Aarya K."
          className="max-w-xs"
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="review-body">Your review</Label>
        <Textarea
          id="review-body"
          value={body}
          rows={4}
          maxLength={MAX_BODY_LENGTH}
          placeholder="How was the fabric, the fit, the delivery?"
          onChange={(event) => setBody(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {MAX_BODY_LENGTH - body.length} characters left.
        </p>
      </div>

      <Button
        type="button"
        disabled={busy || name.trim().length < 2 || body.trim().length < 4}
        onClick={() => void submit()}
      >
        {busy ? "Sending…" : "Send review"}
      </Button>
    </div>
  );
}
