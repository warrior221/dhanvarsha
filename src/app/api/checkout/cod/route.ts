import { OtpPurpose } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-guards";
import { AppError, apiSuccess, handleApiError } from "@/lib/errors";
import { verifyOtp } from "@/lib/otp";
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
 * The confirmation code is consumed here rather than through /api/otp/verify,
 * so a code cannot be burned by a request that then fails to place an order.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const ip = clientIpFrom(request.headers);

    await enforceRateLimit("codOrder", ip);
    await enforceRateLimit("codOrder", `user:${user.id}`);

    const body: unknown = await request.json();
    const { addressId, code } = codOrderSchema.parse(body);

    if (!user.email) {
      throw new AppError(
        "NO_EMAIL",
        "Your account has no email address to confirm against.",
        400,
      );
    }

    // Throws unless the code is live, unexpired and has attempts left.
    await verifyOtp({
      identifier: user.email,
      purpose: OtpPurpose.COD_CONFIRMATION,
      code,
    });

    // Stock, order, audit trail and cart clearing all happen in one
    // transaction (spec 1.5 / 8.5).
    const order = await placeCodOrder(user.id, addressId);

    return apiSuccess(order, 201);
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
