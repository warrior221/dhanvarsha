import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/errors";

const ROUTE = "PATCH /api/admin/inventory";

const bodySchema = z.object({
  variantId: z.string().trim().min(1).max(64),
  stockQty: z
    .number()
    .int("Stock must be a whole number.")
    .min(0, "Stock cannot be negative.")
    .max(100_000),
});

/**
 * Sets an absolute stock count for one size.
 *
 * This is a manual correction (a delivery arrived, a stocktake). Stock changes
 * that come from orders are handled inside the order transaction in Phase 6,
 * never here.
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();

    const body: unknown = await request.json();
    const { variantId, stockQty } = bodySchema.parse(body);

    const updated = await db.productVariant.update({
      where: { id: variantId },
      data: { stockQty },
      select: { id: true, stockQty: true },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
