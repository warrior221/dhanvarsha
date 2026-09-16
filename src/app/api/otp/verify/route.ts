import { OtpPurpose } from "@prisma/client";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { AppError, apiSuccess, handleApiError } from "@/lib/errors";
import { verifyOtp } from "@/lib/otp";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { emailSchema, otpVerifySchema } from "@/lib/validations/auth";

const ROUTE = "POST /api/otp/verify";

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFrom(request.headers);
    const body: unknown = await request.json();
    const { identifier, purpose, code } = otpVerifySchema.parse(body);

    await enforceRateLimit("otpVerify", ip);
    await enforceRateLimit("otpVerify", `id:${identifier}`);

    if (purpose !== OtpPurpose.EMAIL_VERIFICATION) {
      // Phone/COD verification arrives with the COD flow in Phase 6.
      throw new AppError(
        "UNSUPPORTED_PURPOSE",
        "That verification type is not available yet.",
        501,
      );
    }

    const email = emailSchema.parse(identifier);

    // Throws unless the code is live, unexpired and has attempts left.
    await verifyOtp({ identifier: email, purpose, code });

    // updateMany so a user deleted mid-flow is a no-op rather than a throw.
    await db.user.updateMany({
      where: { email, emailVerified: null },
      data: { emailVerified: new Date() },
    });

    return apiSuccess({ message: "Your email is verified. You can sign in now." });
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
