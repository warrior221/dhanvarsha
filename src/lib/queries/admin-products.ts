import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { generateBarcode } from "@/lib/barcode";
import { moveStock, setStockTo } from "@/lib/queries/stock";
import { toPaise } from "@/lib/format";
import type { ProductFormInput } from "@/lib/validations/product";

/**
 * Admin-side product queries. These are the ONLY place cost price is read or
 * written, and every caller must already have passed requireAdmin().
 */

export const ADMIN_PAGE_SIZE = 20;

export type AdminProductRow = {
  id: string;
  /** The piece's one code, printed on its tag. Null only if it has no piece. */
  code: string | null;
  name: string;
  slug: string;
  isActive: boolean;
  categoryName: string;
  /** Null when no "was" price is set. */
  mrp: string | null;
  /** Null until the admin prices the piece. Until then it is not on the shop. */
  sellingPrice: string | null;
  costPrice: string | null;
  /** ADMIN ONLY, like cost price — it lives in the same protected table. */
  supplierName: string | null;
  /** Margin as a whole percentage of the selling price, null without a cost. */
  marginPercent: number | null;
  totalStock: number;
  variantCount: number;
  imageUrl: string | null;
  createdAt: string;
};

export type AdminProductList = {
  rows: AdminProductRow[];
  total: number;
  page: number;
  pageCount: number;
};

export type AdminProductFilters = {
  q?: string | null;
  categoryId?: string | null;
  /** "active" | "inactive" | "all" */
  status?: string | null;
  /** Only products with a variant at or below the low-stock threshold. */
  soldOutOnly?: boolean;
  /**
   * Which side of the pricing line to list. Omitted means both.
   *
   * An unpriced piece is one that has been entered but not yet priced, and
   * pricing it is what puts it on the shop. They are kept in their own list
   * rather than mixed into the catalogue: with ten thousand pieces to tag
   * gradually, the unpriced ones would otherwise drown everything else.
   */
  pricing?: "priced" | "unpriced";
  page?: number;
};


export async function listAdminProducts(
  filters: AdminProductFilters = {},
): Promise<AdminProductList> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const and: Prisma.ProductWhereInput[] = [];

  if (filters.q) {
    and.push({
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        // The code on the tag, which is the only code a piece has.
        { variants: { some: { barcode: { contains: filters.q, mode: "insensitive" } } } },
      ],
    });
  }

  if (filters.categoryId) and.push({ categoryId: filters.categoryId });

  if (filters.status === "active") and.push({ isActive: true });
  if (filters.status === "inactive") and.push({ isActive: false });

  // Sold out, not "running low". Holding one or two of a piece is normal in
  // this shop, so a low-stock filter would match almost everything and tell
  // the owner nothing. Zero is the only count that is actionable.
  if (filters.soldOutOnly) {
    and.push({ variants: { every: { stockQty: 0 } } });
  }

  // Priced means BOTH, because that is what the shop requires to show a piece.
  if (filters.pricing === "priced") {
    and.push({ mrp: { not: null }, sellingPrice: { not: null } });
  }
  if (filters.pricing === "unpriced") {
    and.push({ OR: [{ mrp: null }, { sellingPrice: null }] });
  }

  const where: Prisma.ProductWhereInput = and.length > 0 ? { AND: and } : {};

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        mrp: true,
        sellingPrice: true,
        createdAt: true,
        category: { select: { name: true } },
        // Admin opts IN to cost. Customer selects never include this.
        cost: { select: { costPrice: true, supplierName: true } },
        images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
        variants: { select: { stockQty: true, barcode: true } },
      },
    }),
  ]);

  const rows: AdminProductRow[] = products.map((product) => {
    const sellingPrice = product.sellingPrice?.toString() ?? null;
    const costPrice = product.cost?.costPrice.toString() ?? null;

    return {
      id: product.id,
      code: product.variants[0]?.barcode ?? null,
      name: product.name,
      slug: product.slug,
      isActive: product.isActive,
      categoryName: product.category.name,
      mrp: product.mrp?.toString() ?? null,
      sellingPrice,
      costPrice,
      supplierName: product.cost?.supplierName ?? null,
      marginPercent:
        costPrice && sellingPrice ? marginPercent(sellingPrice, costPrice) : null,
      totalStock: product.variants.reduce((sum, v) => sum + v.stockQty, 0),
      variantCount: product.variants.length,
      imageUrl: product.images[0]?.url ?? null,
      createdAt: product.createdAt.toISOString(),
    };
  });

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

/** Whole-percent margin on the selling price, in integer paise. */
export function marginPercent(sellingPrice: string, costPrice: string): number | null {
  const selling = toPaise(sellingPrice);
  const cost = toPaise(costPrice);

  if (selling <= 0) return null;

  return Math.round(((selling - cost) / selling) * 100);
}

export type AdminProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  mrp: string;
  sellingPrice: string;
  costPrice: string;
  supplierName: string;
  purchaseNote: string;
  isActive: boolean;
  careInstructions: string;
  silkMarkNumber: string;
  colourName: string;
  /** A sibling colour, which is how the form expresses "same design as". */
  sameDesignAsProductId: string | null;
  /** The other colours of this design, for the form to show what it is linked to. */
  otherColours: { id: string; name: string; colourName: string | null }[];
  images: { url: string; publicId: string; altText: string }[];
  /** The one variant's stock. */
  stockQty: number;
  /** The piece's one code. Read-only: issued once and never reissued. */
  code: string | null;
  attributeValueIds: string[];
};

export type DesignMatch = {
  id: string;
  name: string;
  /** The piece's code, printed on its tag. */
  code: string | null;
  colourName: string | null;
  imageUrl: string | null;
  /** How many colours are already linked together, including this one. */
  coloursInGroup: number;
};

/**
 * Finds a product to link a colour to.
 *
 * Searches unpriced pieces too: colours are usually entered one after another,
 * and the second one is often linked before either has been priced.
 */
export async function searchDesigns(
  query: string,
  excludeProductId?: string,
): Promise<DesignMatch[]> {
  const term = query.trim();

  if (term.length < 2) return [];

  const products = await db.product.findMany({
    where: {
      ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { colourName: { contains: term, mode: "insensitive" } },
        { variants: { some: { barcode: { contains: term, mode: "insensitive" } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      colourName: true,
      groupId: true,
      images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
      variants: { select: { barcode: true }, orderBy: { barcode: "asc" }, take: 1 },
    },
  });

  const groupIds = [
    ...new Set(products.map((p) => p.groupId).filter((id): id is string => id !== null)),
  ];

  const counts = await db.product.groupBy({
    by: ["groupId"],
    where: { groupId: { in: groupIds } },
    _count: { _all: true },
  });

  const sizeByGroup = new Map(counts.map((row) => [row.groupId, row._count._all]));

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    code: product.variants[0]?.barcode ?? null,
    colourName: product.colourName,
    imageUrl: product.images[0]?.url ?? null,
    coloursInGroup:
      product.groupId === null ? 1 : (sizeByGroup.get(product.groupId) ?? 1),
  }));
}

/**
 * How many pieces are entered but not yet priced.
 *
 * Shown beside the nav link so the queue cannot be forgotten about. A piece
 * sitting here is stock the shop owns that no customer can buy.
 */
export async function countUnpricedProducts(): Promise<number> {
  return db.product.count({
    where: { OR: [{ mrp: null }, { sellingPrice: null }] },
  });
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      categoryId: true,
      mrp: true,
      sellingPrice: true,
      isActive: true,
      careInstructions: true,
      silkMarkNumber: true,
      colourName: true,
      groupId: true,
      cost: { select: { costPrice: true, supplierName: true, purchaseNote: true } },
      images: {
        select: { url: true, publicId: true, altText: true },
        orderBy: { position: "asc" },
      },
      // Exactly one. The form cannot make a second, and nothing else does.
      variants: {
        orderBy: { barcode: "asc" },
        take: 1,
        select: { id: true, stockQty: true, barcode: true },
      },
      attributes: { select: { valueId: true } },
    },
  });

  if (!product) return null;

  // The other colours of this design, if it is part of a group.
  const otherColours =
    product.groupId === null
      ? []
      : await db.product.findMany({
          where: { groupId: product.groupId, id: { not: product.id } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, colourName: true },
        });

  const piece = product.variants[0];

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.categoryId,
    mrp: product.mrp?.toString() ?? "",
    sellingPrice: product.sellingPrice?.toString() ?? "",
    costPrice: product.cost?.costPrice.toString() ?? "",
    supplierName: product.cost?.supplierName ?? "",
    purchaseNote: product.cost?.purchaseNote ?? "",
    isActive: product.isActive,
    careInstructions: product.careInstructions ?? "",
    silkMarkNumber: product.silkMarkNumber ?? "",
    colourName: product.colourName ?? "",
    sameDesignAsProductId: otherColours[0]?.id ?? null,
    otherColours,
    images: product.images,
    stockQty: piece?.stockQty ?? 0,
    code: piece?.barcode ?? null,
    attributeValueIds: product.attributes.map((link) => link.valueId),
  };
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export async function createProduct(
  input: ProductFormInput,
  /** Whoever is signed in, recorded against the stock this creates. */
  adminId: string,
): Promise<string> {
  await assertUnique({ slug: input.slug });

  const product = await db.$transaction(async (tx) => {
    const groupId = await resolveDesignGroup(tx, {
      sameDesignAsProductId: input.sameDesignAsProductId,
    });

    const created = await tx.product.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        categoryId: input.categoryId,
        mrp: emptyToNull(input.mrp),
        sellingPrice: emptyToNull(input.sellingPrice),
        isActive: input.isActive,
        careInstructions: emptyToNull(input.careInstructions),
        silkMarkNumber: emptyToNull(input.silkMarkNumber),
        colourName: emptyToNull(input.colourName),
        groupId,
      },
      select: { id: true },
    });

    await tx.productCost.create({
      data: {
        productId: created.id,
        costPrice: input.costPrice,
        supplierName: emptyToNull(input.supplierName),
        purchaseNote: emptyToNull(input.purchaseNote),
      },
    });

    await tx.productImage.createMany({
      data: input.images.map((image, index) => ({
        productId: created.id,
        url: image.url,
        publicId: image.publicId,
        altText: image.altText,
        position: index,
      })),
    });

    // Exactly one variant, created automatically. Every piece the shop sells is
    // one size, so there is nothing for the owner to choose.
    //
    // Created at zero, then the opening stock is ADDED as a movement rather than
    // written straight into stockQty. Every piece of stock this shop has must be
    // explainable from the ledger, including the first.
    const piece = await tx.productVariant.create({
      data: {
        productId: created.id,
        // The piece's price IS the product's selling price. Two prices that are
        // meant to be equal eventually are not.
        price: emptyToNull(input.sellingPrice),
        stockQty: 0,
        // Issued here and never changed. A barcode is ink on a tag; reissuing
        // one would invalidate every label already printed.
        barcode: generateBarcode(),
      },
      select: { id: true },
    });

    if (input.stockQty !== 0) {
      await moveStock(tx, {
        variantId: piece.id,
        delta: input.stockQty,
        reason: "OPENING_BALANCE",
        createdById: adminId,
        note: "Entered with the product.",
      });
    }

    if (input.attributeValueIds.length > 0) {
      await tx.productAttributeValue.createMany({
        data: input.attributeValueIds.map((valueId) => ({
          productId: created.id,
          valueId,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  return product.id;
}

export async function updateProduct(
  id: string,
  input: ProductFormInput,
  /** Whoever is signed in, recorded against any stock this changes. */
  adminId: string,
): Promise<void> {
  const existing = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      groupId: true,
      variants: { orderBy: { barcode: "asc" }, select: { id: true } },
      images: { select: { publicId: true } },
    },
  });

  if (!existing) {
    throw new AppError("PRODUCT_NOT_FOUND", "That product no longer exists.", 404);
  }

  await assertUnique({ slug: input.slug, exceptProductId: id });

  // The form has no way to add or remove a variant any more, so this NEVER
  // deletes one. Deleting a variant would cascade its stock movements away, and
  // the ledger is the shop's only record of where a saree went.
  const piece = existing.variants[0];

  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        categoryId: input.categoryId,
        mrp: emptyToNull(input.mrp),
        sellingPrice: emptyToNull(input.sellingPrice),
        isActive: input.isActive,
        careInstructions: emptyToNull(input.careInstructions),
        silkMarkNumber: emptyToNull(input.silkMarkNumber),
        colourName: emptyToNull(input.colourName),
        // Self-links are ignored rather than refused: the form shows a sibling,
        // and a product cannot be a different colour of itself.
        groupId: await resolveDesignGroup(tx, {
          sameDesignAsProductId:
            input.sameDesignAsProductId === id ? null : input.sameDesignAsProductId,
          currentGroupId: existing.groupId,
        }),
      },
    });

    await tx.productCost.upsert({
      where: { productId: id },
      update: {
        costPrice: input.costPrice,
        supplierName: emptyToNull(input.supplierName),
        purchaseNote: emptyToNull(input.purchaseNote),
      },
      create: {
        productId: id,
        costPrice: input.costPrice,
        supplierName: emptyToNull(input.supplierName),
        purchaseNote: emptyToNull(input.purchaseNote),
      },
    });

    // Images are positional and cheap; replace them wholesale.
    await tx.productImage.deleteMany({ where: { productId: id } });
    await tx.productImage.createMany({
      data: input.images.map((image, index) => ({
        productId: id,
        url: image.url,
        publicId: image.publicId,
        altText: image.altText,
        position: index,
      })),
    });

    if (piece) {
      // The price follows the product's selling price, so the two can never
      // disagree. The tag code is deliberately not touched: it is ink on a tag.
      await tx.productVariant.update({
        where: { id: piece.id },
        data: { price: emptyToNull(input.sellingPrice) },
      });

      // Stock is NOT written directly. A count typed into the product form is
      // still a stock change and still owes the ledger a reason.
      await setStockTo(tx, {
        variantId: piece.id,
        newQty: input.stockQty,
        reason: "ADJUSTMENT",
        note: "Changed on the product form.",
        createdById: adminId,
      });
    } else {
      // A product with no variant at all should not exist, but if one does the
      // fix is to give it the piece it is missing rather than to fail the save.
      const made = await tx.productVariant.create({
        data: {
          productId: id,
          price: emptyToNull(input.sellingPrice),
          stockQty: 0,
          barcode: generateBarcode(),
        },
        select: { id: true },
      });

      if (input.stockQty !== 0) {
        await moveStock(tx, {
          variantId: made.id,
          delta: input.stockQty,
          reason: "OPENING_BALANCE",
          createdById: adminId,
          note: "Piece created for a product that had none.",
        });
      }
    }

    // Unlinking the last colour leaves its set behind with nothing in it.
    await dropGroupIfEmpty(tx, existing.groupId);

    await tx.productAttributeValue.deleteMany({ where: { productId: id } });

    if (input.attributeValueIds.length > 0) {
      await tx.productAttributeValue.createMany({
        data: input.attributeValueIds.map((valueId) => ({ productId: id, valueId })),
        skipDuplicates: true,
      });
    }
  });

  // Photos dropped from the product are now orphans in the media library.
  // Cleared AFTER the transaction commits: a failed save must not delete
  // images the product still points at. Failures here are logged, not thrown —
  // a stale file is untidy, a failed save is not.
  const keptPublicIds = new Set(input.images.map((image) => image.publicId));
  const orphans = existing.images
    .map((image) => image.publicId)
    .filter((publicId) => !keptPublicIds.has(publicId));

  if (orphans.length === 0) return;

  // Imported here rather than at the top of the file. The ImageKit SDK is
  // server-only in a way that cannot be loaded outside Next's runtime, and
  // pulling it in at module load stops this file being used from a script — the
  // check scripts that prove product writes behave would not run at all.
  const { destroyImage } = await import("@/lib/imagekit");

  await Promise.all(orphans.map(destroyImage));
}

/**
 * Hard delete, only when nothing references the product. Anything that has
 * ever been ordered is deactivated instead, so invoices and profit reports
 * keep working.
 */
export async function deleteProduct(id: string): Promise<{ deleted: boolean }> {
  const ordered = await db.orderItem.count({
    where: { variant: { productId: id } },
  });

  if (ordered > 0) {
    throw new AppError(
      "PRODUCT_IN_USE",
      "This product appears on past orders, so it cannot be deleted. Mark it inactive instead — it will disappear from the shop but stay on those orders.",
      409,
    );
  }

  const product = await db.product.findUnique({
    where: { id },
    select: { groupId: true, images: { select: { publicId: true } } },
  });

  const images = product?.images ?? [];

  await db.product.delete({ where: { id } });

  // Deleting the last colour of a design leaves its set behind with nothing in
  // it. A set is only an identity, so an empty one says nothing.
  await dropGroupIfEmpty(db, product?.groupId ?? null);

  // The rows are gone, so nothing references these files any more. Imported
  // here for the same reason as above: the ImageKit SDK cannot load outside
  // Next's runtime.
  if (images.length > 0) {
    const { destroyImage } = await import("@/lib/imagekit");
    await Promise.all(images.map((image) => destroyImage(image.publicId)));
  }

  return { deleted: true };
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  await db.product.update({ where: { id }, data: { isActive } });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function assertUnique({
  slug,
  exceptProductId,
}: {
  slug: string;
  exceptProductId?: string;
}): Promise<void> {
  const clash = await db.product.findFirst({
    where: {
      slug,
      ...(exceptProductId ? { NOT: { id: exceptProductId } } : {}),
    },
    select: { slug: true },
  });

  if (!clash) return;

  throw new AppError(
    "DUPLICATE",
    `The web address "${slug}" is already used by another product.`,
    409,
  );
}

/**
 * Works out which design group a product belongs in.
 *
 * Colours are separate products on purpose — each is a separate piece on the
 * shelf with its own tag, cost, stock and photographs. A group records only that
 * they are the same design, so each one's page can offer the others.
 *
 * EVERY COLOUR IN A SET SEES EVERY OTHER. That is why linking two products that
 * are each already in a set MERGES the two sets rather than moving one product
 * across. Moving it across would quietly cut it off from the colours it was
 * linked to before, and the owner would have no way of noticing: the piece they
 * were looking at would still show a colour, just not all of them.
 *
 * Returns null when nothing was pointed at, which is how a colour leaves a set.
 */
async function resolveDesignGroup(
  tx: Prisma.TransactionClient,
  input: {
    sameDesignAsProductId: string | null;
    /** The group this product is in today. Null when it is being created. */
    currentGroupId?: string | null;
  },
): Promise<string | null> {
  const { sameDesignAsProductId, currentGroupId = null } = input;

  if (sameDesignAsProductId === null) return null;

  const other = await tx.product.findUnique({
    where: { id: sameDesignAsProductId },
    select: { id: true, groupId: true },
  });

  if (!other) {
    throw new AppError(
      "DESIGN_NOT_FOUND",
      "The piece you linked this colour to no longer exists.",
      404,
    );
  }

  // Already the same set; nothing to do.
  if (other.groupId !== null && other.groupId === currentGroupId) return currentGroupId;

  // This piece has a set and the other does not: bring the other in, so the
  // colours already linked here keep seeing each other.
  if (currentGroupId !== null && other.groupId === null) {
    await tx.product.update({ where: { id: other.id }, data: { groupId: currentGroupId } });
    return currentGroupId;
  }

  // Both have a set, and they are different sets: merge them into one, so every
  // colour on both sides ends up seeing every other.
  if (currentGroupId !== null && other.groupId !== null) {
    await tx.product.updateMany({
      where: { groupId: other.groupId },
      data: { groupId: currentGroupId },
    });
    await tx.productGroup.delete({ where: { id: other.groupId } });
    return currentGroupId;
  }

  // This piece has no set. Join the other's, or start one and put it in too.
  if (other.groupId !== null) return other.groupId;

  const group = await tx.productGroup.create({ data: {}, select: { id: true } });

  await tx.product.update({ where: { id: other.id }, data: { groupId: group.id } });

  return group.id;
}

/**
 * Removes a design group once its last colour has left it.
 *
 * A group is only an identity, so an empty one says nothing and would otherwise
 * accumulate quietly every time a colour is unlinked.
 */
async function dropGroupIfEmpty(
  tx: Prisma.TransactionClient,
  groupId: string | null,
): Promise<void> {
  if (groupId === null) return;

  const remaining = await tx.product.count({ where: { groupId } });

  if (remaining === 0) await tx.productGroup.delete({ where: { id: groupId } });
}

