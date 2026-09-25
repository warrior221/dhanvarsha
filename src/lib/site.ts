/**
 * The shop's own address.
 *
 * Search engines need absolute URLs — a sitemap full of "/products/foo" is
 * worthless — so this is the single place that knows where the site lives.
 * Set NEXT_PUBLIC_APP_URL to the real domain before going live, or Google
 * will be handed a map of localhost.
 */
const FALLBACK = "http://localhost:3000";

function base(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  // Trailing slashes double up once a path is appended.
  return (configured && configured.length > 0 ? configured : FALLBACK).replace(/\/+$/, "");
}

/** An absolute URL for a path on this site. `siteUrl()` is the home page. */
export function siteUrl(path = "/"): string {
  return path === "/" ? base() : `${base()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Makes a stored image URL absolute.
 *
 * Product photos come back from ImageKit already absolute; a category tile is
 * a local file and starts with a slash. Anything else — an empty string, a
 * data URI — returns null so it can be dropped rather than published as a
 * broken entry.
 */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return siteUrl(url);
  return null;
}
