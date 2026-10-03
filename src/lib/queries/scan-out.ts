import { normaliseScan } from "@/lib/barcode";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { moveStock } from "@/lib/queries/stock";

/**
 * Taking a piece out of stock when it leaves the shop.
 *
 * THIS IS NOT BILLING. The bill is still written in the bill book; this only
 * keeps the website's stock true. Nothing here records a price, a payment or a
 * customer, and no receipt comes out of it.
 *
 * Admin only: the owner has said there will be no staff accounts, so there is
 * no STAFF role and nothing here has to hide cost or supplier from anyone.
 */

export type ScannedPiece = {
  variantId: string;
  barcode: string;
  productName: string;
  stockQty: number;
  /** Null when the piece has not been priced, which is fine for scanning out. */
  sellingPrice: string | null;
  imageUrl: string | null;
};

/** Finds the piece a scanned tag belongs to, without changing anything. */
export async function lookupByBarcode(raw: string): Promise<ScannedPiece> {
  const barcode = normaliseScan(raw);

  const variant = await db.productVariant.findUnique({
    where: { barcode },
    select: {
      id: true,
      stockQty: true,
      barcode: true,
      price: true,
      product: {
        select: {
          name: true,
          sellingPrice: true,
          images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
        },
      },
    },
  });

  if (!variant?.barcode) {
    throw new AppError(
      "TAG_NOT_FOUND",
      "No piece has that tag. It may never have been entered.",
      404,
    );
  }

  return {
    variantId: variant.id,
    barcode: variant.barcode,
    productName: variant.product.name,
    stockQty: variant.stockQty,
    // The variant price is what a customer would pay; the product's is display.
    sellingPrice: variant.price?.toString() ?? variant.product.sellingPrice?.toString() ?? null,
    imageUrl: variant.product.images[0]?.url ?? null,
  };
}

/**
 * Removes one piece from stock.
 *
 * moveStock's decrement is conditional, so a piece bought online a moment
 * earlier cannot also be scanned out here — whichever lands second is refused
 * rather than taking stock below zero.
 */
export async function scanOut(
  raw: string,
  adminId: string,
): Promise<{ piece: ScannedPiece; movementId: string; remaining: number }> {
  const piece = await lookupByBarcode(raw);

  if (piece.stockQty < 1) {
    throw new AppError(
      "NONE_IN_STOCK",
      "None in stock in the system. It may have just sold online, or it was never entered.",
      409,
    );
  }

  const result = await db.$transaction((tx) =>
    moveStock(tx, {
      variantId: piece.variantId,
      delta: -1,
      reason: "SHOP_CHECKOUT",
      createdById: adminId,
    }),
  );

  return {
    piece: { ...piece, stockQty: result.balanceAfter },
    movementId: result.movementId,
    remaining: result.balanceAfter,
  };
}

export type ScanRecord = {
  movementId: string;
  at: string;
  productName: string;
  code: string;
  by: string | null;
  undone: boolean;
};

/** What has been scanned out since midnight, most recent first. */
export async function todaysScans(): Promise<ScanRecord[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const rows = await db.stockMovement.findMany({
    where: { reason: "SHOP_CHECKOUT", createdAt: { gte: start } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
      // Set when a correcting movement points back at this one.
      reversedBy: { select: { id: true } },
      variant: {
        select: {
          barcode: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    movementId: row.id,
    at: row.createdAt.toISOString(),
    productName: row.variant.product.name,
    code: row.variant.barcode,
    by: row.createdBy?.name ?? row.createdBy?.email ?? null,
    undone: row.reversedBy !== null,
  }));
}

/**
 * Puts a scanned piece back.
 *
 * Writes a NEW movement pointing at the original rather than editing or
 * deleting it. `reversesMovementId` is unique, so the same scan cannot be
 * undone twice — the second attempt is refused by the database.
 */
export async function undoScan(
  movementId: string,
  adminId: string,
  note: string,
): Promise<{ remaining: number }> {
  const original = await db.stockMovement.findUnique({
    where: { id: movementId },
    select: { id: true, variantId: true, delta: true, reason: true },
  });

  if (!original || original.reason !== "SHOP_CHECKOUT") {
    throw new AppError("NOT_A_SCAN", "That is not a counter scan.", 400);
  }

  try {
    const result = await db.$transaction((tx) =>
      moveStock(tx, {
        variantId: original.variantId,
        // Mirrors the original exactly, whatever it was.
        delta: -original.delta,
        reason: "SHOP_CHECKOUT_UNDO",
        reversesMovementId: original.id,
        createdById: adminId,
        note,
      }),
    );

    return { remaining: result.balanceAfter };
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(
      "ALREADY_UNDONE",
      "That scan has already been put back.",
      409,
    );
  }
}
