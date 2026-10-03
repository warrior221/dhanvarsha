import { generateBarcode } from "@/lib/barcode";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { moveStock } from "@/lib/queries/stock";
import { slugify } from "@/lib/validations/product";
import type { PurchaseFormInput } from "@/lib/validations/purchase";

/**
 * Checking a delivery in.
 *
 * One transaction creates the products, their variants, the purchase record
 * and a stock movement per row. Either all of it lands or none of it does —
 * a delivery half-recorded is worse than one not recorded at all, because the
 * shop would believe stock it does not have.
 *
 * Everything slow happens BEFORE the transaction opens: photos are already
 * uploaded by the browser, and the codes below are generated in memory. Neon
 * gives an interactive transaction five seconds and every round trip inside it
 * counts against that.
 */

/** P-0001 upwards, from however many deliveries have been recorded. */
async function nextPurchaseNumber(): Promise<string> {
  const count = await db.purchase.count();
  return `P-${String(count + 1).padStart(4, "0")}`;
}

export type PurchaseResult = {
  purchaseNumber: string;
  productsCreated: number;
  piecesAdded: number;
};

export async function recordPurchase(
  input: PurchaseFormInput,
  adminId: string,
): Promise<PurchaseResult> {
  const categories = await db.category.findMany({
    where: { id: { in: input.lines.map((line) => line.categoryId) } },
    select: { id: true, name: true },
  });
  const categoryById = new Map(categories.map((row) => [row.id, row]));

  for (const line of input.lines) {
    if (!categoryById.has(line.categoryId)) {
      throw new AppError("BAD_CATEGORY", "One of those types no longer exists.", 400);
    }
  }

  // Prepared outside the transaction: names, codes and barcodes are pure and
  // cost nothing, but generating them inside would spend Neon's budget.
  const prepared = input.lines.map((line) => {
    const category = categoryById.get(line.categoryId)!;
    // The ONE code this piece will carry, printed on its tag. Nothing else is
    // invented: a second, made-up code would mean nothing to anybody.
    const barcode = generateBarcode();
    // A piece with no name yet is named after its type and the tail of its code,
    // so it can be found and re-tagged later. The owner renames it when pricing.
    const tail = barcode.slice(-5);
    const name = line.name?.trim() || `${category.name} ${tail}`;

    return {
      line,
      name,
      slug: `${slugify(name)}-${tail.toLowerCase()}`,
      barcode,
    };
  });

  const purchaseNumber = await nextPurchaseNumber();

  return db.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        purchaseNumber,
        supplierId: input.supplierId,
        note: input.note?.trim() || null,
        createdById: adminId,
      },
      select: { id: true },
    });

    let piecesAdded = 0;

    for (const item of prepared) {
      const product = await tx.product.create({
        data: {
          name: item.name,
          slug: item.slug,
          description: "",
          categoryId: item.line.categoryId,
          // No prices yet. The piece is in stock and in the admin, and stays
          // off the shop until it is priced.
          mrp: null,
          sellingPrice: null,
          colourName: item.line.colourName?.trim() || null,
          images: {
            create: item.line.images.map((image, index) => ({
              url: image.url,
              publicId: image.publicId,
              altText: image.altText,
              position: index,
            })),
          },
          cost: {
            create: {
              costPrice: item.line.costPrice,
              supplierId: input.supplierId,
            },
          },
        },
        select: { id: true },
      });

      const variant = await tx.productVariant.create({
        data: {
          productId: product.id,
          price: null,
          stockQty: 0,
          barcode: item.barcode,
        },
        select: { id: true },
      });

      await moveStock(tx, {
        variantId: variant.id,
        delta: item.line.quantity,
        // Opening stock was already on the shelf; a delivery arrived today.
        // The ledger should be able to tell those apart forever.
        reason: input.isOpeningStock ? "OPENING_BALANCE" : "PURCHASE",
        createdById: adminId,
        note: input.isOpeningStock ? "Already in the shop." : `Delivery ${purchaseNumber}.`,
      });

      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          variantId: variant.id,
          quantity: item.line.quantity,
          unitCost: item.line.costPrice,
        },
      });

      piecesAdded += item.line.quantity;
    }

    return {
      purchaseNumber,
      productsCreated: prepared.length,
      piecesAdded,
    };
  });
}
