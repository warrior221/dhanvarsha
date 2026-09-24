import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { destroyImage } from "@/lib/imagekit";
import { toPaise } from "@/lib/format";
import type { ProductFormInput } from "@/lib/validations/product";

/**
 * Admin-side product queries. These are the ONLY place cost price is read or
 * written, and every caller must already have passed requireAdmin().
 */

export const ADMIN_PAGE_SIZE = 20;

export type AdminProductRow = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  isActive: boolean;
  categoryName: string;
  mrp: string;
  sellingPrice: string;
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
        { sku: { contains: filters.q, mode: "insensitive" } },
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
        sku: true,
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
        variants: { select: { stockQty: true } },
      },
    }),
  ]);

  const rows: AdminProductRow[] = products.map((product) => {
    const sellingPrice = product.sellingPrice.toString();
    const costPrice = product.cost?.costPrice.toString() ?? null;

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      slug: product.slug,
      isActive: product.isActive,
      categoryName: product.category.name,
      mrp: product.mrp.toString(),
      sellingPrice,
      costPrice,
      supplierName: product.cost?.supplierName ?? null,
      marginPercent: costPrice ? marginPercent(sellingPrice, costPrice) : null,
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
  sku: string;
  description: string;
  categoryId: string;
  mrp: string;
  sellingPrice: string;
  costPrice: string;
  supplierName: string;
  purchaseNote: string;
  isReadymade: boolean;
  isActive: boolean;
  careInstructions: string;
  images: { url: string; publicId: string; altText: string }[];
  variants: { id: string; size: string; sku: string; price: string; stockQty: number }[];
  attributeValueIds: string[];
};

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      description: true,
      categoryId: true,
      mrp: true,
      sellingPrice: true,
      isReadymade: true,
      isActive: true,
      careInstructions: true,
      cost: { select: { costPrice: true, supplierName: true, purchaseNote: true } },
      images: {
        select: { url: true, publicId: true, altText: true },
        orderBy: { position: "asc" },
      },
      variants: {
        select: { id: true, size: true, sku: true, price: true, stockQty: true },
      },
      attributes: { select: { valueId: true } },
    },
  });

  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    categoryId: product.categoryId,
    mrp: product.mrp.toString(),
    sellingPrice: product.sellingPrice.toString(),
    costPrice: product.cost?.costPrice.toString() ?? "",
    supplierName: product.cost?.supplierName ?? "",
    purchaseNote: product.cost?.purchaseNote ?? "",
    isReadymade: product.isReadymade,
    isActive: product.isActive,
    careInstructions: product.careInstructions ?? "",
    images: product.images,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      // The schema allows a null size; the admin form requires one, so an
      // older row without it is surfaced as "Free Size" rather than blank.
      size: variant.size ?? "Free Size",
      sku: variant.sku,
      price: variant.price.toString(),
      stockQty: variant.stockQty,
    })),
    attributeValueIds: product.attributes.map((link) => link.valueId),
  };
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export async function createProduct(input: ProductFormInput): Promise<string> {
  await assertUnique({ slug: input.slug, sku: input.sku });
  await assertVariantSkusFree(input.variants.map((v) => v.sku));

  const product = await db.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: input.name,
        slug: input.slug,
        sku: input.sku,
        description: input.description,
        categoryId: input.categoryId,
        mrp: input.mrp,
        sellingPrice: input.sellingPrice,
        isReadymade: input.isReadymade,
        isActive: input.isActive,
        careInstructions: emptyToNull(input.careInstructions),
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

    await tx.productVariant.createMany({
      data: input.variants.map((variant) => ({
        productId: created.id,
        size: variant.size,
        sku: variant.sku,
        price: variant.price,
        stockQty: variant.stockQty,
      })),
    });

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

export async function updateProduct(id: string, input: ProductFormInput): Promise<void> {
  const existing = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      variants: { select: { id: true, sku: true } },
      images: { select: { publicId: true } },
    },
  });

  if (!existing) {
    throw new AppError("PRODUCT_NOT_FOUND", "That product no longer exists.", 404);
  }

  await assertUnique({ slug: input.slug, sku: input.sku, exceptProductId: id });

  const keptIds = new Set(
    input.variants.map((variant) => variant.id).filter((v): v is string => Boolean(v)),
  );
  const removed = existing.variants.filter((variant) => !keptIds.has(variant.id));

  // A variant that appears on a past order cannot be deleted: OrderItem points
  // at it, and rewriting order history is exactly what spec section 4 forbids.
  if (removed.length > 0) {
    const ordered = await db.orderItem.findMany({
      where: { variantId: { in: removed.map((v) => v.id) } },
      select: { variant: { select: { sku: true } } },
      distinct: ["variantId"],
    });

    if (ordered.length > 0) {
      throw new AppError(
        "VARIANT_IN_USE",
        `These sizes appear on past orders and cannot be removed: ${ordered
          .map((row) => row.variant.sku)
          .join(", ")}. Set their stock to 0 instead.`,
        409,
      );
    }
  }

  await assertVariantSkusFree(
    input.variants.filter((v) => !v.id).map((v) => v.sku),
    id,
  );

  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        sku: input.sku,
        description: input.description,
        categoryId: input.categoryId,
        mrp: input.mrp,
        sellingPrice: input.sellingPrice,
        isReadymade: input.isReadymade,
        isActive: input.isActive,
        careInstructions: emptyToNull(input.careInstructions),
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

    if (removed.length > 0) {
      await tx.productVariant.deleteMany({
        where: { id: { in: removed.map((v) => v.id) } },
      });
    }

    for (const variant of input.variants) {
      if (variant.id) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            size: variant.size,
            sku: variant.sku,
            price: variant.price,
            stockQty: variant.stockQty,
          },
        });
      } else {
        await tx.productVariant.create({
          data: {
            productId: id,
            size: variant.size,
            sku: variant.sku,
            price: variant.price,
            stockQty: variant.stockQty,
          },
        });
      }
    }

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

  const images = await db.product
    .findUnique({ where: { id }, select: { images: { select: { publicId: true } } } })
    .then((product) => product?.images ?? []);

  await db.product.delete({ where: { id } });

  // The rows are gone, so nothing references these files any more.
  await Promise.all(images.map((image) => destroyImage(image.publicId)));

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
  sku,
  exceptProductId,
}: {
  slug: string;
  sku: string;
  exceptProductId?: string;
}): Promise<void> {
  const clash = await db.product.findFirst({
    where: {
      OR: [{ slug }, { sku }],
      ...(exceptProductId ? { NOT: { id: exceptProductId } } : {}),
    },
    select: { slug: true, sku: true },
  });

  if (!clash) return;

  throw new AppError(
    "DUPLICATE",
    clash.slug === slug
      ? `The web address "${slug}" is already used by another product.`
      : `SKU "${sku}" is already used by another product.`,
    409,
  );
}

async function assertVariantSkusFree(skus: string[], exceptProductId?: string) {
  if (skus.length === 0) return;

  const clash = await db.productVariant.findFirst({
    where: {
      sku: { in: skus },
      ...(exceptProductId ? { NOT: { productId: exceptProductId } } : {}),
    },
    select: { sku: true },
  });

  if (clash) {
    throw new AppError(
      "DUPLICATE",
      `Size SKU "${clash.sku}" is already used by another product.`,
      409,
    );
  }
}
