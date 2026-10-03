import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The other colours of this design.
 *
 * Each colour is a SEPARATE PRODUCT, because that is what it is on the shelf: its
 * own piece, its own tag, its own cost and its own photographs. So these are
 * links to those products rather than options on this one — the page changes, the
 * price and the photographs change with it, and nothing has to pretend that one
 * product holds stock it does not.
 *
 * It sits directly above Add to bag, where a shopper is deciding.
 *
 * Renders nothing at all when a design has only one colour, which is most of
 * them. An empty "Colours" heading would be worse than no heading.
 */
export function ColourSwitcher({
  currentName,
  currentColourName,
  colours,
}: {
  currentName: string;
  currentColourName: string | null;
  colours: {
    id: string;
    name: string;
    slug: string;
    colourName: string | null;
    image: { url: string; altText: string } | null;
    stockQty: number;
  }[];
}) {
  if (colours.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-sm font-medium">
        Colour
        {currentColourName ? (
          <span className="ml-1 font-normal text-muted-foreground">
            · {currentColourName}
          </span>
        ) : null}
      </p>

      <ul className="flex flex-wrap gap-2">
        {/* The one being looked at, so the row reads as a set rather than as
            "somewhere else to go". */}
        <li>
          <span
            aria-current="page"
            className="flex items-center gap-2 rounded-md border-2 border-foreground bg-muted/40 py-1 pl-1 pr-3 text-sm font-medium"
          >
            <Swatch image={null} alt="" fallback={currentColourName ?? currentName} />
            {currentColourName ?? "This one"}
          </span>
        </li>

        {colours.map((colour) => {
          const soldOut = colour.stockQty <= 0;

          return (
            <li key={colour.id}>
              <Link
                href={`/products/${colour.slug}`}
                // A shopper needs to know before tapping, not after the page
                // has loaded. Sold-out colours still link: the piece exists and
                // may come back, and a dead swatch explains nothing.
                aria-label={
                  soldOut
                    ? `${colour.colourName ?? colour.name} — sold out`
                    : (colour.colourName ?? colour.name)
                }
                className={cn(
                  "flex items-center gap-2 rounded-md border py-1 pl-1 pr-3 text-sm transition",
                  "hover:border-foreground/40",
                  soldOut && "text-muted-foreground",
                )}
              >
                <Swatch
                  image={colour.image}
                  alt=""
                  fallback={colour.colourName ?? colour.name}
                />
                <span className={cn(soldOut && "line-through decoration-1")}>
                  {colour.colourName ?? colour.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The photograph is the swatch: a real saree beats a guessed hex value. */
function Swatch({
  image,
  alt,
  fallback,
}: {
  image: { url: string; altText: string } | null;
  alt: string;
  fallback: string;
}) {
  if (!image) {
    return (
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded bg-muted text-xs font-medium text-muted-foreground"
      >
        {fallback.trim().charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={image.url}
      alt={alt}
      width={32}
      height={32}
      sizes="32px"
      className="size-8 shrink-0 rounded object-cover"
    />
  );
}
