import type { Prisma } from "@/generated/prisma";

/**
 * Explicit selects for customer-facing queries.
 *
 * `cost` is deliberately absent from every one of these. Leaking cost price to
 * a shopper is the single worst data leak this shop could have, so admin code
 * must opt in with `include: { cost: true }` rather than customer code having
 * to remember to opt out (spec 1.3 / 8.2).
 */

/**
 * What makes a product visible to a shopper.
 *
 * Active, AND priced. A piece is entered when it arrives from the weaver and
 * priced later, so between those two moments it sits in the database and no
 * customer sees it. Pricing it is what puts it on the shop.
 *
 * Every customer-facing query spreads this. Writing the two conditions out by
 * hand in six places is how one of them quietly ends up missing.
 */
export const PUBLIC_PRODUCT_WHERE = {
  isActive: true,
  mrp: { not: null },
  sellingPrice: { not: null },
} satisfies Prisma.ProductWhereInput;

/**
 * Reads a price that PUBLIC_PRODUCT_WHERE guarantees is there.
 *
 * A null here means a customer-facing query dropped that filter — a bug that
 * would otherwise render "₹NaN" to a shopper, or worse, offer a piece with no
 * price. Failing loudly is the lesser harm.
 */
function requiredPrice(value: { toString(): string } | null, what: string): string {
  if (value === null) {
    throw new Error(
      `${what} reached a customer view with no price. A query is missing PUBLIC_PRODUCT_WHERE.`,
    );
  }
  return value.toString();
}

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
  silkMarkNumber: true,
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
  // Needed to tell a saved piece that is still on sale from one that is not.
  isActive: true,
  variants: { select: { id: true, size: true, stockQty: true } },
} as const satisfies Prisma.ProductSelect;

type RawWishlistProduct = Prisma.ProductGetPayload<{
  select: typeof wishlistProductSelect;
}>;

/**
 * A saved piece, WHICH MAY NO LONGER BE ON SALE.
 *
 * Nothing ever leaves a wishlist on its own. A piece whose price was cleared,
 * or that was deactivated, stays saved and is shown as unavailable — someone
 * saved it on purpose, and silently emptying their list is worse than telling
 * them it has gone. So the price here is nullable where the shop grid's is not.
 */
export type WishlistProductView = Omit<ProductCardView, "sellingPrice"> & {
  sellingPrice: string | null;
  /** False when the piece has no price or has been deactivated. */
  isAvailable: boolean;
  variants: { id: string; size: string | null; stockQty: number }[];
};

export function toWishlistProductView(
  product: RawWishlistProduct,
): WishlistProductView {
  // Built field by field rather than through toProductCardView, which asserts
  // a price. Here a missing price is expected, not a bug: it means the piece
  // has been taken off sale since it was saved.
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    mrp: product.mrp?.toString() ?? null,
    sellingPrice: product.sellingPrice?.toString() ?? null,
    isAvailable: product.sellingPrice !== null && product.isActive,
    isReadymade: product.isReadymade,
    category: product.category,
    image: product.images[0] ?? null,
    totalStock: product.variants.reduce((sum, v) => sum + v.stockQty, 0),
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
  /** Null when the piece has no "was" price to strike through. */
  mrp: string | null;
  sellingPrice: string;
  isReadymade: boolean;
  careInstructions: string | null;
  /** Set only on a piece that carries a Silk Mark hologram tag. */
  silkMarkNumber: string | null;
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
  /** Null when the piece has no "was" price to strike through. */
  mrp: string | null;
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
    mrp: product.mrp?.toString() ?? null,
    sellingPrice: requiredPrice(product.sellingPrice, product.slug),
    isReadymade: product.isReadymade,
    careInstructions: product.careInstructions,
    silkMarkNumber: product.silkMarkNumber,
    category: product.category,
    images: product.images,
    variants: [...product.variants].sort(compareVariants).map((variant) => ({
      id: variant.id,
      size: variant.size,
      price: requiredPrice(variant.price, `${product.slug} variant ${variant.id}`),
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
    mrp: product.mrp?.toString() ?? null,
    sellingPrice: requiredPrice(product.sellingPrice, product.slug),
    isReadymade: product.isReadymade,
    category: product.category,
    image: product.images[0] ?? null,
    totalStock: product.variants.reduce((sum, v) => sum + v.stockQty, 0),
  };
}
