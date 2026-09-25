import { OrderStatus } from "@/generated/prisma";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { transitionOrder } from "@/lib/queries/admin-orders";

const ROUTE = "POST /api/admin/orders/[id]/status";

const bodySchema = z.object({
  to: z.enum(OrderStatus),
  courierName: z.string().trim().max(100).optional(),
  trackingNumber: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Moves an order to its next status.
 *
 * The transition rules, the tracking requirement and the stock restore are all
 * enforced in transitionOrder(), server-side. The admin UI greys out the
 * impossible buttons, but that is only a convenience — this is the boundary
 * that actually decides.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/admin/orders/[id]/status">,
) {
  try {
    const admin = await requireAdmin();

    // params is a Promise in Next.js 16.
    const { id } = await context.params;
    const body: unknown = await request.json();
    const input = bodySchema.parse(body);

    await transitionOrder({
      orderId: id,
      to: input.to,
      adminId: admin.id,
      courierName: input.courierName,
      trackingNumber: input.trackingNumber,
      note: input.note,
    });

    return apiSuccess({ id, status: input.to });
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
