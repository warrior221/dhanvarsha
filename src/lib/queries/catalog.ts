import type { Prisma } from "@prisma/client";
import {
  buildProductWhere,
  PAGE_SIZE,
  type CatalogParams,
  type FilterableAttribute,
} from "@/lib/catalog";
import { db } from "@/lib/db";
import {
  productCardSelect,
  toProductCardView,
  type ProductCardView,
} from "@/lib/queries/product";

/**
 * Database side of the catalog. Server-only — this imports lib/db.
 * The pure types, SORT_OPTIONS and the param parsing live in @/lib/catalog so
 * client components can use them without dragging Prisma into the browser.
 */

/** Attributes that drive the sidebar; new values appear automatically. */
export async function getFilterableAttributes(): Promise<FilterableAttribute[]> {
  return db.attribute.findMany({
    where: { isFilterable: true },
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      inputType: true,
      values: {
        orderBy: { position: "asc" },
        select: { id: true, value: true, slug: true },
      },
    },
  });
}

export type CatalogResult = {
  products: ProductCardView[];
  total: number;
  page: number;
  pageCount: number;
};

export async function getCatalogPage(params: CatalogParams): Promise<CatalogResult> {
  const where = buildProductWhere(params);

  if (params.sort === "popularity") {
    return getPopularityPage(where, params.page);
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    params.sort === "price-asc"
      ? { sellingPrice: "asc" }
      : params.sort === "price-desc"
        ? { sellingPrice: "desc" }
        : { createdAt: "desc" };

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy,
      select: productCardSelect,
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return {
    products: rows.map(toProductCardView),
    total,
    page: params.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/**
 * Popularity means order count, which lives two relations away
 * (Product -> ProductVariant -> OrderItem). Prisma can only order by a direct
 * relation's _count, so the ranking is done in SQL and that page of ids is
 * then hydrated through the normal select.
 */
async function getPopularityPage(
  where: Prisma.ProductWhereInput,
  page: number,
): Promise<CatalogResult> {
  const matching = await db.product.findMany({ where, select: { id: true } });
  const ids = matching.map((row) => row.id);

  if (ids.length === 0) {
    return { products: [], total: 0, page, pageCount: 1 };
  }

  const ranked = await db.$queryRaw<{ id: string }[]>`
    SELECT p."id"
    FROM "Product" p
    LEFT JOIN "ProductVariant" v ON v."productId" = p."id"
    LEFT JOIN "OrderItem" oi ON oi."variantId" = v."id"
    WHERE p."id" = ANY(${ids})
    GROUP BY p."id", p."createdAt"
    ORDER BY COUNT(oi."id") DESC, p."createdAt" DESC
  `;

  const pageCount = Math.max(1, Math.ceil(ids.length / PAGE_SIZE));

  const pageIds = ranked
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    .map((row) => row.id);

  if (pageIds.length === 0) {
    return { products: [], total: ids.length, page, pageCount };
  }

  const rows = await db.product.findMany({
    where: { id: { in: pageIds } },
    select: productCardSelect,
  });

  // findMany does not preserve the order of `in`, so restore the ranking.
  const byId = new Map(rows.map((row) => [row.id, row]));
  const products = pageIds
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row !== undefined)
    .map(toProductCardView);

  return { products, total: ids.length, page, pageCount };
}
