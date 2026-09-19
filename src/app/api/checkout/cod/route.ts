import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { placeCodOrder } from "@/lib/queries/checkout";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { codOrderSchema } from "@/lib/validations/checkout";

const ROUTE = "POST /api/checkout/cod";

/**
 * Places a cash-on-delivery order.
 *
 * Note what is NOT in the request body: any amount. The total is recomputed
 * server-side from the cart and the shipping rules, so a tampered price cannot
 * reach an order (spec 8.4).
 *
 * Identity is established by requireUser(). An account cannot sign in until
 * its email is verified, so reaching this route already proves the customer
 * controls the address on the account — which is what the old per-order
 * confirmation code proved a second time.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const ip = clientIpFrom(request.headers);

    await enforceRateLimit("codOrder", ip);
    await enforceRateLimit("codOrder", `user:${user.id}`);

    const body: unknown = await request.json();
    const { addressId } = codOrderSchema.parse(body);

    // Stock, order, audit trail and cart clearing all happen in one
    // transaction (spec 1.5 / 8.5).
    const order = await placeCodOrder(user.id, addressId);

    return apiSuccess(order, 201);
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
