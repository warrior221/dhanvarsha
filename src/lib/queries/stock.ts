import type { Prisma, StockReason } from "@/generated/prisma";
import { AppError } from "@/lib/errors";

/**
 * The only way stock is allowed to change.
 *
 * `ProductVariant.stockQty` is a cached balance; `StockMovement` is the truth.
 * Writing one without the other is how a shop ends up with a number nobody can
 * explain, so this does both, in one statement each, inside the caller's
 * transaction. No code path may write `stockQty` directly.
 *
 * Takes a transaction client rather than the global `db` on purpose: a stock
 * change that is not part of the surrounding transaction can be left behind
 * when that transaction rolls back, which is exactly the drift this exists to
 * prevent.
 */

/** Reasons that mean nothing without a sentence from whoever chose them. */
const REASONS_NEEDING_A_NOTE: StockReason[] = ["DAMAGE", "ADJUSTMENT"];

export type MoveStockInput = {
  variantId: string;
  /** Signed. Positive came in, negative went out. Zero is refused. */
  delta: number;
  reason: StockReason;
  /** Set when an online order caused this. */
  orderId?: string | null;
  /** Set on a correcting movement, pointing at the one it reverses. */
  reversesMovementId?: string | null;
  note?: string | null;
  /** Null when the shop itself moved the stock, rather than a person. */
  createdById?: string | null;
};

export type StockMovementResult = {
  movementId: string;
  balanceAfter: number;
};

export async function moveStock(
  tx: Prisma.TransactionClient,
  input: MoveStockInput,
): Promise<StockMovementResult> {
  const { variantId, delta, reason } = input;

  if (!Number.isInteger(delta) || delta === 0) {
    throw new AppError(
      "INVALID_STOCK_MOVE",
      "A stock movement must be a whole number and cannot be zero.",
      400,
    );
  }

  const note = input.note?.trim() || null;

  if (REASONS_NEEDING_A_NOTE.includes(reason) && !note) {
    throw new AppError(
      "NOTE_REQUIRED",
      "Say what happened — a damage or adjustment with no note cannot be explained later.",
      400,
    );
  }

  // One statement that both guards and applies. The `stockQty` filter makes it
  // impossible for two orders racing for the last piece to both succeed:
  // whichever loses matches no row and throws below.
  //
  // It also returns the new balance, so recording the movement costs no extra
  // round trip — Neon's transaction budget is five seconds and every trip
  // counts against it.
  let balanceAfter: number;

  try {
    const updated = await tx.productVariant.update({
      where: delta < 0 ? { id: variantId, stockQty: { gte: -delta } } : { id: variantId },
      data: { stockQty: { increment: delta } },
      select: { stockQty: true },
    });
    balanceAfter = updated.stockQty;
  } catch {
    // Either the variant is gone, or there was not enough stock to take.
    throw new AppError(
      "INSUFFICIENT_STOCK",
      "That piece is no longer available in the quantity asked for.",
      409,
    );
  }

  const movement = await tx.stockMovement.create({
    data: {
      variantId,
      delta,
      balanceAfter,
      reason,
      orderId: input.orderId ?? null,
      reversesMovementId: input.reversesMovementId ?? null,
      note,
      createdById: input.createdById ?? null,
    },
    select: { id: true },
  });

  return { movementId: movement.id, balanceAfter };
}

/**
 * Sets a variant's stock to an absolute figure by recording the difference.
 *
 * For the admin's "adjust stock" box, where the owner types what is actually
 * on the shelf rather than how much it moved. Returns null when the figure
 * already matches, because a movement of zero says nothing.
 */
export async function setStockTo(
  tx: Prisma.TransactionClient,
  input: {
    variantId: string;
    newQty: number;
    reason: StockReason;
    note?: string | null;
    createdById?: string | null;
  },
): Promise<StockMovementResult | null> {
  const current = await tx.productVariant.findUnique({
    where: { id: input.variantId },
    select: { stockQty: true },
  });

  if (!current) {
    throw new AppError("VARIANT_NOT_FOUND", "That size no longer exists.", 404);
  }

  const delta = input.newQty - current.stockQty;

  if (delta === 0) return null;

  return moveStock(tx, {
    variantId: input.variantId,
    delta,
    reason: input.reason,
    note: input.note,
    createdById: input.createdById,
  });
}
