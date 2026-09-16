import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { SearchParams } from "@/lib/catalog";

/**
 * Server-rendered pagination: plain links, so pages are crawlable and work
 * without JavaScript. Every existing filter is carried across.
 */
export function Pagination({
  page,
  pageCount,
  searchParams,
}: {
  page: number;
  pageCount: number;
  searchParams: SearchParams;
}) {
  if (pageCount <= 1) return null;

  function hrefFor(target: number): string {
    const next = new URLSearchParams();

    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page" || value === undefined) continue;
      next.set(key, Array.isArray(value) ? (value[0] ?? "") : value);
    }

    if (target > 1) next.set("page", String(target));

    const query = next.toString();
    return query ? `/products?${query}` : "/products";
  }

  return (
    <nav
      className="flex items-center justify-between gap-4 border-t pt-6"
      aria-label="Pagination"
    >
      {page > 1 ? (
        <Button asChild variant="outline">
          <Link href={hrefFor(page - 1)} rel="prev">
            Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Previous
        </Button>
      )}

      <p className="text-sm text-muted-foreground" aria-current="page">
        Page {page} of {pageCount}
      </p>

      {page < pageCount ? (
        <Button asChild variant="outline">
          <Link href={hrefFor(page + 1)} rel="next">
            Next
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Next
        </Button>
      )}
    </nav>
  );
}
