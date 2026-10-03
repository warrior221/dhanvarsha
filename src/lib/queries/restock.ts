import { normaliseScan } from "@/lib/barcode";
import { paiseToDecimal } from "@/lib/cart";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { formatInr, toPaise } from "@/lib/format";
import { moveStock } from "@/lib/queries/stock";
import type { RestockFormInput } from "@/lib/validations/restock";

/**
 * Adding more of something the shop already has.
 *
 * The owner expects to tag a new batch as a new design most of the time, so
 * this is the uncommon path — but it has to exist, and it is the one place the
 * stored cost price is allowed to move.
 *
 * WHAT IS NEVER REWRITTEN. Recording a restock leaves every earlier figure
 * exactly as it was: the `unitCost` on old purchase lines, the `costPrice`
 * snapshot on old order items (so last month's profit does not change because
 * of a delivery today), and every stock movement already in the ledger. Only
 * `ProductCost.costPrice` moves, and it moves to the weighted average.
 *
 * ADMIN ONLY. Everything here is cost and supplier.
 */

/* -------------------------------------------------------------------------- */
/* Finding something to restock                                               */
/* -------------------------------------------------------------------------- */

export type RestockCandidate = {
  productId: string;
  name: string;
  /** The piece's one code, printed on its tag. */
  code: string | null;
  /** Null when the piece has never been given a cost. */
  currentCost: string | null;
  currentCostFormatted: string | null;
  /** Pieces on hand, which is what the weighted average is weighted by. */
  onHand: number;
  imageUrl: string | null;
  /** The one piece. Null only for a product with no variant, which is a fault. */
  piece: { variantId: string; stockQty: number } | null;
};

/**
 * Searches by name or by the code on the tag.
 *
 * A tag is the fastest way in: the piece in hand is the piece to add to, and
 * typing a name risks landing on last season's design of the same name.
 */
export async function findRestockCandidates(query: string): Promise<RestockCandidate[]> {
  const term = query.trim();

  if (term.length < 2) return [];

  const scanned = normaliseScan(term);

  const products = await db.product.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { variants: { some: { barcode: scanned } } },
        { variants: { some: { barcode: { contains: term, mode: "insensitive" } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      name: true,
      cost: { select: { costPrice: true } },
      images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
      variants: {
        orderBy: { barcode: "asc" },
        take: 1,
        select: { id: true, stockQty: true, barcode: true },
      },
    },
  });

  return products.map((product) => {
    const cost = product.cost?.costPrice.toString() ?? null;
    const piece = product.variants[0] ?? null;

    return {
      productId: product.id,
      name: product.name,
      code: piece?.barcode ?? null,
      currentCost: cost,
      currentCostFormatted: cost === null ? null : formatInr(cost),
      onHand: piece?.stockQty ?? 0,
      imageUrl: product.images[0]?.url ?? null,
      piece: piece === null ? null : { variantId: piece.id, stockQty: piece.stockQty },
    };
  });
}

/* -------------------------------------------------------------------------- */
/* The weighted average                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Blends the old cost with this batch's, by how many pieces each represents.
 *
 * Worked in whole paise so there is no floating-point money anywhere, and
 * rounded to the nearest paise at the end.
 *
 * With nothing on hand there is nothing to blend: everything the old cost
 * described has already been sold, so averaging against it would carry a figure
 * forward that no longer has any stock behind it. The batch cost simply becomes
 * the cost.
 */
export function weightedAverageCost(input: {
  onHand: number;
  oldCost: string | null;
  addedQty: number;
  batchCost: string;
}): string {
  const batchPaise = toPaise(input.batchCost);

  if (input.oldCost === null || input.onHand <= 0) return paiseToDecimal(batchPaise);

  const oldPaise = toPaise(input.oldCost);
  const totalQty = input.onHand + input.addedQty;
  const totalPaise = input.onHand * oldPaise + input.addedQty * batchPaise;

  return paiseToDecimal(Math.round(totalPaise / totalQty));
}

/* -------------------------------------------------------------------------- */
/* Recording it                                                               */
/* -------------------------------------------------------------------------- */

/** R-0001 upwards, counted separately from deliveries of new designs. */
async function nextRestockNumber(): Promise<string> {
  const count = await db.purchase.count({ where: { purchaseNumber: { startsWith: "R-" } } });
  return `R-${String(count + 1).padStart(4, "0")}`;
}

export type RestockResult = {
  purchaseNumber: string;
  piecesAdded: number;
  /** One per product, so the screen can show how each cost moved. */
  costChanges: {
    productId: string;
    name: string;
    from: string | null;
    to: string;
    unchanged: boolean;
  }[];
};

export async function recordRestock(
  input: RestockFormInput,
  adminId: string,
): Promise<RestockResult> {
  // Read everything and work out the new costs BEFORE the transaction opens.
  // Neon gives an interactive transaction five seconds, and arithmetic inside
  // it would spend that budget for nothing.
  const products = await db.product.findMany({
    where: { id: { in: input.lines.map((line) => line.productId) } },
    select: {
      id: true,
      name: true,
      cost: { select: { costPrice: true, supplierId: true } },
      variants: { orderBy: { barcode: "asc" }, take: 1, select: { id: true, stockQty: true } },
    },
  });

  const productById = new Map(products.map((product) => [product.id, product]));

  const prepared = input.lines.map((line) => {
    const product = productById.get(line.productId);

    if (!product) {
      throw new AppError("PRODUCT_GONE", "One of those pieces no longer exists.", 404);
    }

    const piece = product.variants[0];

    if (!piece) {
      throw new AppError(
        "NO_PIECE",
        `"${product.name}" has nothing to add stock to. Open it in Products and save it once.`,
        409,
      );
    }

    const oldCost = product.cost?.costPrice.toString() ?? null;

    const newCost = weightedAverageCost({
      onHand: piece.stockQty,
      oldCost,
      addedQty: line.quantity,
      batchCost: line.costPrice,
    });

    return { line, product, piece, oldCost, addedQty: line.quantity, newCost };
  });

  const purchaseNumber = await nextRestockNumber();

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
      await moveStock(tx, {
        variantId: item.piece.id,
        delta: item.line.quantity,
        reason: "PURCHASE",
        createdById: adminId,
        note: `More stock, ${purchaseNumber}.`,
      });

      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          variantId: item.piece.id,
          quantity: item.line.quantity,
          // A snapshot of what THIS batch cost. Never touched again, even
          // though the product's average cost moves below.
          unitCost: item.line.costPrice,
        },
      });

      piecesAdded += item.line.quantity;

      // The one figure a restock is allowed to move.
      //
      // `supplierId` is only filled in when the product had none. A product's
      // supplier means "who supplies this", and overwriting it because one
      // batch came from someone else would lose the usual weaver. Which weaver
      // supplied THIS batch is on the purchase record, where it is accurate.
      await tx.productCost.upsert({
        where: { productId: item.product.id },
        create: {
          productId: item.product.id,
          costPrice: item.newCost,
          supplierId: input.supplierId,
        },
        update: {
          costPrice: item.newCost,
          ...(item.product.cost?.supplierId == null && input.supplierId
            ? { supplierId: input.supplierId }
            : {}),
        },
      });
    }

    return {
      purchaseNumber,
      piecesAdded,
      costChanges: prepared.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        from: item.oldCost,
        to: item.newCost,
        unchanged: item.oldCost === item.newCost,
      })),
    };
  });
}
