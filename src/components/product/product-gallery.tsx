"use client";

import Image from "next/image";
import { useState, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

export type GalleryImage = { url: string; altText: string; position: number };

/**
 * Image gallery with thumbnails and hover-to-zoom.
 *
 * Zoom is a transform on the image rather than a second larger request, so it
 * costs nothing extra to load.
 */
export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");

  if (images.length === 0) {
    return (
      <div className="flex aspect-[2/3] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        No photos yet
      </div>
    );
  }

  const active = images[activeIndex] ?? images[0]!;

  function onMove(event: MouseEvent<HTMLDivElement>) {
    if (!zoomed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
  }

  return (
    <div className="space-y-3">
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted"
        onMouseMove={onMove}
        onMouseLeave={() => setZoomed(false)}
      >
        <button
          type="button"
          className="absolute inset-0 z-10 cursor-zoom-in"
          aria-label={zoomed ? "Zoom out" : "Zoom in"}
          aria-pressed={zoomed}
          onClick={() => setZoomed((on) => !on)}
        />
        <Image
          key={active.url}
          src={active.url}
          alt={active.altText}
          fill
          sizes="(min-width: 1024px) 45vw, 100vw"
          priority
          className={cn(
            "object-cover transition-transform duration-200",
            zoomed && "scale-[2]",
          )}
          style={zoomed ? { transformOrigin: origin } : undefined}
        />
      </div>

      {images.length > 1 ? (
        <ul className="grid grid-cols-5 gap-2" aria-label="Product photos">
          {images.map((image, index) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => {
                  setActiveIndex(index);
                  setZoomed(false);
                }}
                aria-label={`Show photo ${index + 1} of ${images.length}`}
                aria-current={index === activeIndex}
                className={cn(
                  "relative block aspect-[2/3] w-full overflow-hidden rounded-md bg-muted ring-offset-background transition",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                  index === activeIndex
                    ? "ring-2 ring-foreground"
                    : "opacity-70 hover:opacity-100",
                )}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="15vw"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
