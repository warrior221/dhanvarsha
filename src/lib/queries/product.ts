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
  name: true,
  slug: true,
  description: true,
  mrp: true,
  sellingPrice: true,
  careInstructions: true,
  silkMarkNumber: true,
  colourName: true,
  category: { select: { id: true, name: true, slug: true } },
  images: {
    select: { url: true, altText: true, position: true },
    orderBy: { position: "asc" },
  },
  // Exactly one. Every piece the shop sells is one size, so there is nothing to
  // choose; `orderBy` only keeps the choice deterministic for the two
  // placeholder products that still carry sizes from before.
  variants: {
    select: { id: true, price: true, stockQty: true, barcode: true },
    orderBy: { barcode: "asc" },
    take: 1,
  },
  /**
   * The other colours of this design.
   *
   * Filtered by the same visibility rule as any other listing, so a colour that
   * has been unpriced or hidden is not offered. Sold-out colours ARE offered:
   * the page says so, and hiding them would make a design look thinner than it
   * is.
   */
  group: {
    select: {
      products: {
        where: PUBLIC_PRODUCT_WHERE,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          colourName: true,
          images: { select: { url: true, altText: true }, orderBy: { position: "asc" }, take: 1 },
          variants: { select: { stockQty: true }, orderBy: { barcode: "asc" }, take: 1 },
        },
      },
    },
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
  name: true,
  slug: true,
  mrp: true,
  sellingPrice: true,
  colourName: true,
  category: { select: { name: true, slug: true } },
  images: {
    select: { url: true, altText: true },
    orderBy: { position: "asc" },
    take: 1,
  },
  // The one piece, so "in stock" on a tile means the same thing as on the
  // product page. Summing every variant could say in stock while the piece a
  // shopper can actually buy has none left.
  variants: { select: { stockQty: true }, orderBy: { barcode: "asc" }, take: 1 },
} as const satisfies Prisma.ProductSelect;


/**
 * Wishlist cards need variant ids so "move to bag" can add the right one
 * directly when a product has only a single option.
 */
export const wishlistProductSelect = {
  ...productCardSelect,
  // Needed to tell a saved piece that is still on sale from one that is not.
  isActive: true,
  variants: { select: { id: true, stockQty: true }, orderBy: { barcode: "asc" }, take: 1 },
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
  /** The one piece, so "move to bag" knows what to add. Null if none exists. */
  piece: { id: string; stockQty: number } | null;
};

export function toWishlistProductView(
  product: RawWishlistProduct,
): WishlistProductView {
  // Built field by field rather than through toProductCardView, which asserts
  // a price. Here a missing price is expected, not a bug: it means the piece
  // has been taken off sale since it was saved.
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    mrp: product.mrp?.toString() ?? null,
    sellingPrice: product.sellingPrice?.toString() ?? null,
    isAvailable: product.sellingPrice !== null && product.isActive,
    colourName: product.colourName,
    category: product.category,
    image: product.images[0] ?? null,
    totalStock: product.variants[0]?.stockQty ?? 0,
    piece: product.variants[0] ?? null,
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
  name: string;
  slug: string;
  description: string;
  /** Null when the piece has no "was" price to strike through. */
  mrp: string | null;
  sellingPrice: string;
  careInstructions: string | null;
  /** Set only on a piece that carries a Silk Mark hologram tag. */
  silkMarkNumber: string | null;
  /** This entry's colour, e.g. "Royal Blue". Null when it has no label. */
  colourName: string | null;
  category: { id: string; name: string; slug: string };
  images: { url: string; altText: string; position: number }[];
  /**
   * The one piece, and its code.
   *
   * That code is the ONLY one a piece has: it is printed on the tag, scanned at
   * the counter, and what a shopper quotes on the phone. There is deliberately no
   * second, made-up product code to keep in step with it.
   */
  piece: { id: string; price: string; stockQty: number; code: string } | null;
  /** The other colours of this design, for the switcher beside Add to bag. */
  colours: {
    id: string;
    name: string;
    slug: string;
    colourName: string | null;
    image: { url: string; altText: string } | null;
    stockQty: number;
  }[];
  attributes: {
    id: string;
    value: string;
    slug: string;
    attribute: { id: string; name: string; slug: string };
  }[];
};

export type ProductCardView = {
  id: string;
  name: string;
  slug: string;
  /** Null when the piece has no "was" price to strike through. */
  mrp: string | null;
  sellingPrice: string;
  /** This entry's colour, e.g. "Royal Blue". Null when it has no label. */
  colourName: string | null;
  category: { name: string; slug: string };
  image: { url: string; altText: string } | null;
  /** The one piece's stock, so a tile and its product page always agree. */
  totalStock: number;
};

export function toProductView(product: RawProduct): ProductView {
  const piece = product.variants[0] ?? null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    mrp: product.mrp?.toString() ?? null,
    sellingPrice: requiredPrice(product.sellingPrice, product.slug),
    careInstructions: product.careInstructions,
    silkMarkNumber: product.silkMarkNumber,
    colourName: product.colourName,
    category: product.category,
    images: product.images,
    piece:
      piece === null
        ? null
        : {
            id: piece.id,
            price: requiredPrice(piece.price, `${product.slug} piece ${piece.id}`),
            stockQty: piece.stockQty,
            code: piece.barcode,
          },
    // This product is in the group too, so it is filtered out of its own list.
    colours: (product.group?.products ?? [])
      .filter((other) => other.id !== product.id)
      .map((other) => ({
        id: other.id,
        name: other.name,
        slug: other.slug,
        colourName: other.colourName,
        image: other.images[0] ?? null,
        stockQty: other.variants[0]?.stockQty ?? 0,
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
    name: product.name,
    slug: product.slug,
    mrp: product.mrp?.toString() ?? null,
    sellingPrice: requiredPrice(product.sellingPrice, product.slug),
    colourName: product.colourName,
    category: product.category,
    image: product.images[0] ?? null,
    totalStock: product.variants[0]?.stockQty ?? 0,
  };
}
