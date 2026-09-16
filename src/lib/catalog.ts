import type { AttributeInputType, Prisma } from "@prisma/client";

/**
 * Catalog types and pure functions — NO database import.
 *
 * Client components (the filter sidebar, the toolbar) need SORT_OPTIONS and
 * these types. If they imported them from queries/catalog.ts, which imports
 * lib/db.ts, Prisma and the pg driver would be pulled into the browser bundle.
 * Turbopack rightly refuses to build that.
 *
 * `import type` is erased at compile time, so the Prisma type import here
 * costs the client nothing.
 */

export const PAGE_SIZE = 12;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "popularity", label: "Most popular" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((option) => option.value));

export type FilterableAttribute = {
  id: string;
  name: string;
  slug: string;
  inputType: AttributeInputType;
  values: { id: string; value: string; slug: string }[];
};

export type CatalogParams = {
  categorySlug: string | null;
  /** attribute slug -> selected value slugs */
  attributeFilters: Record<string, string[]>;
  minPrice: string | null;
  maxPrice: string | null;
  sort: SortOption;
  page: number;
  q: string | null;
};

export type SearchParams = Record<string, string | string[] | undefined>;

/** Reads the first value when Next hands us a repeated query parameter. */
function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** "wedding,festive" -> ["wedding", "festive"] */
function csv(value: string | string[] | undefined): string[] {
  const raw = single(value);
  if (!raw) return [];

  return [...new Set(raw.split(",").map((part) => part.trim()).filter(Boolean))];
}

function positiveAmount(value: string | string[] | undefined): string | null {
  const raw = single(value);
  if (!raw) return null;

  // Rupees, optionally with paise. Anything else is ignored rather than
  // erroring — a junk URL should show products, not a crash.
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(raw)) return null;

  return raw;
}

export function parseCatalogParams(
  searchParams: SearchParams,
  filterable: FilterableAttribute[],
): CatalogParams {
  const attributeFilters: Record<string, string[]> = {};

  for (const attribute of filterable) {
    const selected = csv(searchParams[attribute.slug]);
    if (selected.length === 0) continue;

    // Keep only slugs that really belong to this attribute, so a crafted URL
    // cannot smuggle arbitrary values into the query.
    const allowed = new Set(attribute.values.map((value) => value.slug));
    const valid = selected.filter((slug) => allowed.has(slug));

    if (valid.length > 0) attributeFilters[attribute.slug] = valid;
  }

  const sortRaw = single(searchParams.sort);
  const pageRaw = Number(single(searchParams.page) ?? "1");
  const q = single(searchParams.q)?.trim() ?? null;

  return {
    categorySlug: single(searchParams.category),
    attributeFilters,
    minPrice: positiveAmount(searchParams.minPrice),
    maxPrice: positiveAmount(searchParams.maxPrice),
    sort: sortRaw && SORT_VALUES.has(sortRaw) ? (sortRaw as SortOption) : "newest",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    q: q && q.length > 0 ? q.slice(0, 100) : null,
  };
}

export function buildProductWhere(params: CatalogParams): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ isActive: true }];

  if (params.categorySlug) {
    and.push({ category: { slug: params.categorySlug } });
  }

  if (params.q) {
    and.push({
      OR: [
        { name: { contains: params.q, mode: "insensitive" } },
        { description: { contains: params.q, mode: "insensitive" } },
      ],
    });
  }

  if (params.minPrice || params.maxPrice) {
    and.push({
      sellingPrice: {
        ...(params.minPrice ? { gte: params.minPrice } : {}),
        ...(params.maxPrice ? { lte: params.maxPrice } : {}),
      },
    });
  }

  // Multi-select WITHIN an attribute is OR (one `some` with an `in`).
  // Across attributes it is AND (a separate `some` per attribute).
  for (const valueSlugs of Object.values(params.attributeFilters)) {
    and.push({
      attributes: { some: { value: { slug: { in: valueSlugs } } } },
    });
  }

  return { AND: and };
}
