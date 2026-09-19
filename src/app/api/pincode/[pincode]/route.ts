import type { NextRequest } from "next/server";
import { AppError, apiSuccess, handleApiError } from "@/lib/errors";
import { isCompletePincode } from "@/lib/pincode";
import { lookupPincode } from "@/lib/queries/pincode";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";

const ROUTE = "GET /api/pincode/[pincode]";

/**
 * City and state for a PIN code.
 *
 * Open to guests: someone filling in a delivery address has not necessarily
 * signed in yet. Rate limited per IP because it can reach an outside API,
 * though a cached PIN code never leaves our database.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/pincode/[pincode]">,
) {
  try {
    await enforceRateLimit("pincode", clientIpFrom(request.headers));

    // params is a Promise in Next.js 16.
    const { pincode } = await context.params;

    if (!isCompletePincode(pincode)) {
      throw new AppError("INVALID_PINCODE", "Enter a valid 6-digit PIN code.", 400);
    }

    const found = await lookupPincode(pincode);

    if (!found) {
      throw new AppError(
        "PINCODE_NOT_FOUND",
        "We could not look that PIN code up. Please type your city and state.",
        404,
      );
    }

    return apiSuccess(found);
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
