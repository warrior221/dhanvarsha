import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { setStockTo } from "@/lib/queries/stock";

const ROUTE = "PATCH /api/admin/inventory";

const bodySchema = z.object({
  variantId: z.string().trim().min(1).max(64),
  stockQty: z
    .number()
    .int("Stock must be a whole number.")
    .min(0, "Stock cannot be negative.")
    .max(100_000),
  /**
   * Why the figure is being changed. Only the two an admin can legitimately
   * choose by hand — a sale or a purchase writes its own movement from the
   * code that performs it, and must never be faked from here.
   */
  reason: z.enum(["DAMAGE", "ADJUSTMENT"]),
  note: z
    .string()
    .trim()
    .min(3, "Say what happened, so this can be explained later.")
    .max(500),
});

/**
 * Adjusts the stock on one size to an absolute figure.
 *
 * Not "set the number": the difference is recorded as a stock movement with a
 * reason and a note, in one transaction, because a count that changes with no
 * explanation is the thing the ledger exists to prevent.
 *
 * Stock changes caused by orders are written by the order transaction itself
 * and never come through here.
 */
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const body: unknown = await request.json();
    const { variantId, stockQty, reason, note } = bodySchema.parse(body);

    const result = await db.$transaction(async (tx) => {
      const movement = await setStockTo(tx, {
        variantId,
        newQty: stockQty,
        reason,
        note,
        createdById: admin.id,
      });

      return {
        id: variantId,
        stockQty: movement?.balanceAfter ?? stockQty,
        // Null when the figure already matched, so nothing was recorded.
        changed: movement !== null,
      };
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
