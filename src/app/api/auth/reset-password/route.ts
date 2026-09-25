import { OtpPurpose } from "@/generated/prisma";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { verifyOtp } from "@/lib/otp";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/lib/validations/auth";

const ROUTE = "POST /api/auth/reset-password";
const BCRYPT_COST = 12;

/**
 * Sets a new password using a code emailed to the account's own address.
 *
 * The code is the proof of identity here — the person has no password to
 * offer. verifyOtp() enforces the rest of spec section 7: the code must be
 * live, unexpired, unconsumed and within its attempt budget, and it is burned
 * on use.
 *
 * Every existing session is destroyed on success. If the reset was prompted
 * by someone else getting into the account, leaving their session alive would
 * defeat the point of the reset.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFrom(request.headers);
    await enforceRateLimit("resetPassword", ip);

    const body: unknown = await request.json();
    const { email, code, password } = resetPasswordSchema.parse(body);

    await enforceRateLimit("resetPassword", `id:${email}`);

    // Throws unless the code is genuine. Deliberately the same failure
    // whether the address has an account or not, so this cannot be used to
    // discover which addresses are registered.
    await verifyOtp({ identifier: email, purpose: OtpPurpose.PASSWORD_RESET, code });

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    await db.$transaction(async (tx) => {
      // updateMany, so an account deleted mid-flow is a no-op rather than a
      // crash after the code has already been consumed.
      const updated = await tx.user.updateMany({
        where: { email },
        data: {
          passwordHash,
          // Reading the code proves control of the mailbox, which is exactly
          // what verification establishes. Without this, someone who never
          // verified could reset their password and still not get in.
          emailVerified: new Date(),
        },
      });

      if (updated.count === 0) return;

      const user = await tx.user.findUnique({ where: { email }, select: { id: true } });

      if (user) {
        await tx.session.deleteMany({ where: { userId: user.id } });
      }
    });

    return apiSuccess({
      message: "Your password is updated. You can sign in now.",
    });
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
