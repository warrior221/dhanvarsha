"use client";

import { Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ShopReviewView } from "@/lib/shop-reviews";
import { relativeMonth } from "@/lib/shop-reviews";
import { cn } from "@/lib/utils";

/**
 * Customer reviews, drifting right to left across the foot of the home page.
 *
 * IT IS A REAL SCROLLING ELEMENT, not a CSS transform, and that is the whole
 * design. Auto-scroll is a loop nudging scrollLeft each frame, so a visitor
 * can swipe it on a phone, drag it with a mouse or flick it with a trackpad
 * at any moment, using the browser's own momentum rather than anything
 * reimplemented here. A transform-based marquee looks the same and cannot be
 * touched.
 *
 * IT IS A RING. The last review is followed by the first, and the first is
 * preceded by the last, in both directions and forever.
 *
 * There are no stacked-up copies. Whenever a card scrolls off the left edge
 * it is moved to the back of the queue and the scroll position is pulled
 * back by exactly its width — the two cancel out, so nothing is seen to
 * move. Swipe the other way and a card is taken off the back and put in
 * front instead. Only as many cards as fill the screen ever exist.
 *
 * The drifting stops whenever someone is reading — pointer over it, keyboard
 * focus inside it, or mid-swipe — and picks up again shortly after.
 *
 * `prefers-reduced-motion` switches the drift off entirely and leaves a strip
 * the visitor scrolls themselves. Moving text is a genuine problem for some
 * people, and a shop cannot know who is looking.
 */

/** Drift speed. Roughly a card every four seconds. */
const PIXELS_PER_SECOND = 70;

/** Quiet time after a swipe before drifting resumes. */
const RESUME_DELAY_MS = 2_000;

/** Movement beyond this is a drag, so the release must not open a review. */
const DRAG_THRESHOLD_PX = 6;

/**
 * How many card slots to keep either side of the visible window.
 *
 * One would be the bare minimum. Two means a fast flick still lands on a
 * card that is already there, rather than on empty track.
 */
const SPARE_SLOTS = 2;

/** Safety valve on the slot count. */
const MAX_SLOTS = 40;

export function ReviewMarquee({ reviews }: { reviews: ShopReviewView[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const paused = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState<ShopReviewView | null>(null);

  /**
   * How many card slots exist. Enough to cover the screen plus a little
   * either side — never a multiple of the whole list.
   */
  const [slots, setSlots] = useState(() =>
    Math.min(MAX_SLOTS, reviews.length + SPARE_SLOTS),
  );

  /**
   * Which review sits in the first slot.
   *
   * Turning the ring is just moving this along: slot i shows
   * reviews[(head + i) % reviews.length]. No cards are created or destroyed.
   */
  const [head, setHead] = useState(0);

  /** Distance from one card to the next, including the gap. */
  const stride = useRef(0);

  const hold = useCallback(() => {
    paused.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  const release = useCallback((delay = 0) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      paused.current = false;
    }, delay);
  }, []);

  /**
   * Turns the ring so the scroll position stays inside the track.
   *
   * Scrolled a card's width past the start, the front card is sent to the
   * back and the scroll position is pulled back by the same distance, which
   * leaves the view exactly where it was. Scrolled back to the start, a card
   * comes off the back to the front instead.
   *
   * flushSync matters here: the rotation must be in the DOM BEFORE the scroll
   * position is corrected, or the browser paints one frame of the old cards
   * at the new position and the ring visibly jumps.
   */
  const wrap = useCallback(() => {
    const node = scroller.current;
    const step = stride.current;

    if (!node || step <= 0 || reviews.length === 0) return;

    // The scroll position is kept inside [step, step * 2) — one card's worth
    // of track behind, one ahead.
    //
    // A single threshold does not work: rotating backwards and landing
    // exactly ON it immediately satisfies the forward test, so the ring spins
    // back and nets nothing. A band leaves the position clear of both edges
    // after every turn.
    const lower = step;
    const upper = step * 2;

    if (node.scrollLeft >= upper) {
      const turns = Math.floor((node.scrollLeft - lower) / step);
      flushSync(() => setHead((h) => (h + turns) % reviews.length));
      node.scrollLeft -= turns * step;
      return;
    }

    if (node.scrollLeft < lower) {
      const turns = Math.ceil((lower - node.scrollLeft) / step);
      flushSync(() =>
        setHead((h) => ((h - turns) % reviews.length + reviews.length) % reviews.length),
      );
      node.scrollLeft += turns * step;
    }
  }, [reviews.length]);

  /** Measures the stride and keeps enough slots to cover the screen. */
  useEffect(() => {
    const node = scroller.current;
    const list = track.current;

    if (!node || !list) return;

    function measure() {
      const n = scroller.current;
      const l = track.current;
      if (!n || !l || l.children.length < 2) return;

      const a = l.children[0] as HTMLElement;
      const b = l.children[1] as HTMLElement;
      const step = b.offsetLeft - a.offsetLeft;

      if (step <= 0) return;

      stride.current = step;

      // Two cards for the band, plus whatever fills the window, plus spares.
      const needed = Math.min(
        MAX_SLOTS,
        Math.ceil(n.clientWidth / step) + 2 + SPARE_SLOTS,
      );

      if (needed !== slots) {
        setSlots(needed);
        return;
      }

      // Rest inside the band, so a backwards swipe has somewhere to go.
      if (n.scrollLeft < step) n.scrollLeft = step;
    }

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(list);

    return () => observer.disconnect();
  }, [slots, reviews.length]);

  /* ----------------------------- the drift ---------------------------- */
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let last = performance.now();

    function step(now: number) {
      const delta = now - last;
      last = now;

      const node = scroller.current;

      if (node && !paused.current) {
        node.scrollLeft += (PIXELS_PER_SECOND * delta) / 1000;
        wrap();
      }

      frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [wrap]);

  /* --------------------------- mouse dragging -------------------------- */
  // Touch and trackpad scroll the element natively. A mouse does not, so
  // click-and-drag is wired up for desktop.
  const drag = useRef<{ startX: number; startScroll: number; moved: number } | null>(
    null,
  );

  /**
   * How far the last gesture travelled, kept AFTER the drag state is cleared.
   *
   * The browser fires pointerup before click, so reading the live drag state
   * from the click handler always found it already nulled — and every drag
   * ended by opening a review.
   */
  const lastDragDistance = useRef(0);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return; // native scrolling handles it

    const node = scroller.current;
    if (!node) return;

    lastDragDistance.current = 0;
    drag.current = { startX: event.clientX, startScroll: node.scrollLeft, moved: 0 };
    hold();
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    const node = scroller.current;
    if (!state || !node) return;

    const dx = event.clientX - state.startX;
    state.moved = Math.max(state.moved, Math.abs(dx));
    lastDragDistance.current = state.moved;
    node.scrollLeft = state.startScroll - dx;
  }

  function endDrag() {
    drag.current = null;
    release(RESUME_DELAY_MS);
  }

  /** True when the pointer travelled far enough that this was a drag, not a tap. */
  function wasDragged(): boolean {
    return lastDragDistance.current > DRAG_THRESHOLD_PX;
  }

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  if (reviews.length === 0) return null;

  return (
    <>
      <div className="relative">
        {/* Faded edges, so cards arrive and leave rather than being cut off. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-muted/30 to-transparent sm:w-16"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-muted/30 to-transparent sm:w-16"
        />

        <div
          ref={scroller}
          role="region"
          aria-label="Customer reviews"
          className={cn(
            "no-scrollbar overflow-x-auto overscroll-x-contain",
            // grab/grabbing only on pointers that actually drag.
            "cursor-grab active:cursor-grabbing",
          )}
          onScroll={wrap}
          onMouseEnter={hold}
          onMouseLeave={() => {
            drag.current = null;
            release();
          }}
          onFocusCapture={hold}
          onBlurCapture={() => release()}
          onTouchStart={hold}
          onTouchEnd={() => release(RESUME_DELAY_MS)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <ul ref={track} className="flex w-max gap-4 px-4">
            {Array.from({ length: slots }, (_, slot) => {
              // The ring: past the last review, round to the first again.
              const review = reviews[(head + slot) % reviews.length]!;

              return (
                <ReviewCard
                  // Keyed by SLOT, not by review. The slots stay put and
                  // their contents shift along as the ring turns, so the
                  // browser moves nothing and the rotation costs nothing.
                  key={slot}
                  review={review}
                  // The first turn of the ring holds every review exactly
                  // once; any slot beyond that is a repeat, and a screen
                  // reader should not hear it twice.
                  ariaHidden={slot >= reviews.length}
                  onOpen={() => {
                    if (!wasDragged()) setOpen(review);
                  }}
                />
              );
            })}
          </ul>
        </div>
      </div>

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        {open ? (
          <DialogContent>
            <DialogTitle className="pr-6 text-xl">{open.authorName}</DialogTitle>

            <DialogDescription className="text-xs">
              {relativeMonth(open.reviewedAt)}
              {open.source === "GOOGLE" ? " · on Google" : ""}
            </DialogDescription>

            <Stars rating={open.rating} className="mt-1" />

            <p className="mt-4 text-base italic leading-relaxed text-foreground/90">
              &ldquo;{open.body}&rdquo;
            </p>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

/**
 * One card.
 *
 * The three lines are deliberately different weights and sizes, so the eye
 * lands on the person first, then the quote, and only notices the date if it
 * goes looking. All-one-size reads as a wall.
 */
function ReviewCard({
  review,
  ariaHidden,
  onOpen,
}: {
  review: ShopReviewView;
  ariaHidden?: boolean;
  onOpen: () => void;
}) {
  return (
    <li aria-hidden={ariaHidden} className="w-[78vw] max-w-sm shrink-0 sm:w-80">
      <button
        type="button"
        tabIndex={ariaHidden ? -1 : undefined}
        onClick={onOpen}
        className="h-full w-full rounded-lg border bg-background p-5 text-left transition hover:border-foreground/30 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* Name: the loudest thing on the card. */}
            <p className="truncate text-base font-bold leading-tight">
              {review.authorName}
            </p>
            {/* Date: quietest — present, but never competing. */}
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {relativeMonth(review.reviewedAt)}
              {review.source === "GOOGLE" ? " · Google" : ""}
            </p>
          </div>

          <Stars rating={review.rating} className="shrink-0" />
        </div>

        {/* The review itself: italic, and clipped to whatever fits. */}
        <p className="mt-3 line-clamp-3 text-sm italic leading-relaxed text-foreground/80">
          &ldquo;{review.body}&rdquo;
        </p>
      </button>
    </li>
  );
}

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span
      className={cn("flex gap-0.5", className)}
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn(
            "size-3.5",
            n <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}
