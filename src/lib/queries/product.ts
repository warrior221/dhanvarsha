import type { Prisma } from "@prisma/client";

/**
 * Explicit selects for customer-facing queries.
 *
 * `cost` is deliberately absent from every one of these. Leaking cost price to
 * a shopper is the single worst data leak this shop could have, so admin code
 * must opt in with `include: { cost: true }` rather than customer code having
 * to remember to opt out (spec 1.3 / 8.2).
 */

/** Everything the product detail page needs. */
export const publicProductSelect = {
  id: true,
  sku: true,
  name: true,
  slug: true,
  description: true,
  mrp: true,
  sellingPrice: true,
  isReadymade: true,
  careInstructions: true,
  category: { select: { id: true, name: true, slug: true } },
  images: {
    select: { url: true, altText: true, position: true },
    orderBy: { position: "asc" },
  },
  variants: {
    select: { id: true, size: true, price: true, stockQty: true },
    orderBy: { sku: "asc" },
  },
  attributes: {
    select: {
      value: {
        select: {
          id: true,
          value: true,
          slug: true,
          attribute: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  },
} as const satisfies Prisma.ProductSelect;

/**
 * Lighter select for grid tiles. A listing of 12 products does not need every
 * description and care instruction, and the first image is the only one shown.
 */
export const productCardSelect = {
  id: true,
  sku: true,
  name: true,
  slug: true,
  mrp: true,
  sellingPrice: true,
  isReadymade: true,
  category: { select: { name: true, slug: true } },
  images: {
    select: { url: true, altText: true },
    orderBy: { position: "asc" },
    take: 1,
  },
  variants: { select: { stockQty: true } },
} as const satisfies Prisma.ProductSelect;


/**
 * Wishlist cards need variant ids so "move to bag" can add the right one
 * directly when a product has only a single option.
 */
export const wishlistProductSelect = {
  ...productCardSelect,
  variants: { select: { id: true, size: true, stockQty: true } },
} as const satisfies Prisma.ProductSelect;

type RawWishlistProduct = Prisma.ProductGetPayload<{
  select: typeof wishlistProductSelect;
}>;

export type WishlistProductView = ProductCardView & {
  variants: { id: string; size: string | null; stockQty: number }[];
};

export function toWishlistProductView(
  product: RawWishlistProduct,
): WishlistProductView {
  return {
    ...toProductCardView(product),
    variants: [...product.variants].sort(compareVariants),
  };
}

/** Admin queries opt IN to cost price. Never use this on a customer route. */
export const adminProductSelect = {
  ...publicProductSelect,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  cost: {
    select: {
      costPrice: true,
      supplierName: true,
      purchaseNote: true,
      updatedAt: true,
    },
  },
} as const satisfies Prisma.ProductSelect;

type RawProduct = Prisma.ProductGetPayload<{ select: typeof publicProductSelect }>;
type RawProductCard = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

/* ------------------------------------------------------------------ */
/* Serialisation                                                       */
/* ------------------------------------------------------------------ */

/**
 * Prisma returns Decimal objects, which cannot cross the Server -> Client
 * component boundary. Converting to STRING rather than number keeps the exact
 * value: Number("8999.00") is fine today but the moment a price needs more
 * precision than a float holds, rounding creeps into money (spec 1.4).
 */

export type ProductView = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  mrp: string;
  sellingPrice: string;
  isReadymade: boolean;
  careInstructions: string | null;
  category: { id: string; name: string; slug: string };
  images: { url: string; altText: string; position: number }[];
  variants: { id: string; size: string | null; price: string; stockQty: number }[];
  attributes: {
    id: string;
    value: string;
    slug: string;
    attribute: { id: string; name: string; slug: string };
  }[];
};

export type ProductCardView = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  mrp: string;
  sellingPrice: string;
  isReadymade: boolean;
  category: { name: string; slug: string };
  image: { url: string; altText: string } | null;
  totalStock: number;
};

/**
 * Garment sizes have a natural order that neither the SKU nor the size string
 * sorts into: ordering by SKU gives "L, M, S, XL". Known sizes come first in
 * this order, then numeric sizes ascending, then anything else alphabetically.
 */
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "3XL", "4XL"];

function sizeRank(size: string | null): number {
  if (size === null) return -1;

  const index = SIZE_ORDER.indexOf(size.trim().toUpperCase());
  if (index !== -1) return index;

  // Numeric sizes (38, 40, 42...) sort after the lettered ones, in order.
  const numeric = Number(size.trim());
  if (Number.isFinite(numeric)) return SIZE_ORDER.length + numeric;

  return Number.MAX_SAFE_INTEGER;
}

function compareVariants(
  a: { size: string | null },
  b: { size: string | null },
): number {
  const rankDifference = sizeRank(a.size) - sizeRank(b.size);
  if (rankDifference !== 0) return rankDifference;

  return (a.size ?? "").localeCompare(b.size ?? "");
}

export function toProductView(product: RawProduct): ProductView {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    description: product.description,
    mrp: product.mrp.toString(),
    sellingPrice: product.sellingPrice.toString(),
    isReadymade: product.isReadymade,
    careInstructions: product.careInstructions,
    category: product.category,
    images: product.images,
    variants: [...product.variants].sort(compareVariants).map((variant) => ({
      id: variant.id,
      size: variant.size,
      price: variant.price.toString(),
      stockQty: variant.stockQty,
    })),
    attributes: product.attributes.map((link) => ({
      id: link.value.id,
      value: link.value.value,
      slug: link.value.slug,
      attribute: link.value.attribute,
    })),
  };
}

export function toProductCardView(product: RawProductCard): ProductCardView {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    mrp: product.mrp.toString(),
    sellingPrice: product.sellingPrice.toString(),
    isReadymade: product.isReadymade,
    category: product.category,
    image: product.images[0] ?? null,
    totalStock: product.variants.reduce((sum, v) => sum + v.stockQty, 0),
  };
}
