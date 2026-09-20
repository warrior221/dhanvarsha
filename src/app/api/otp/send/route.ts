import { OtpChannel, OtpPurpose } from "@prisma/client";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { AppError, apiSuccess, handleApiError } from "@/lib/errors";
import { sendOtp } from "@/lib/otp";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { emailSchema, otpSendSchema } from "@/lib/validations/auth";

const ROUTE = "POST /api/otp/send";

/**
 * Which transport each purpose uses.
 *
 * COD_CONFIRMATION goes by EMAIL rather than phone: SMS needs TRAI DLT
 * registration and WhatsApp needs Meta Business verification, neither of which
 * is in place. The intent of spec section 7 is still met — the order is
 * confirmed through a channel the customer has already proven they control —
 * and switching to WhatsApp later is one line here.
 */
const CHANNEL_FOR: Record<OtpPurpose, OtpChannel> = {
  EMAIL_VERIFICATION: OtpChannel.EMAIL,
  PASSWORD_RESET: OtpChannel.EMAIL,
  COD_CONFIRMATION: OtpChannel.EMAIL,
  PHONE_VERIFICATION: OtpChannel.WHATSAPP,
  // Present only to satisfy the exhaustive Record. ADMIN_MFA is not in
  // otpSendSchema, so this route can never be asked to send one — the admin
  // ladder issues its own codes in queries/admin-mfa.ts.
  ADMIN_MFA: OtpChannel.EMAIL,
};

/**
 * Generic reply used whether or not a code was actually sent. Two different
 * responses here would turn this endpoint into an "does this email have an
 * account?" oracle.
 */
const NEUTRAL_RESPONSE = {
  message: "If that account needs verification, a code is on its way.",
};

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFrom(request.headers);
    const body: unknown = await request.json();
    const { identifier, purpose } = otpSendSchema.parse(body);

    await enforceRateLimit("otpSend", ip);

    const channel = CHANNEL_FOR[purpose];

    if (channel === OtpChannel.WHATSAPP) {
      throw new AppError(
        "CHANNEL_UNAVAILABLE",
        "WhatsApp verification is not available yet.",
        501,
      );
    }

    /* ------------------------- verification codes ------------------------ */
    // Rate limited per IP *and* per identifier (spec section 7), so neither
    // one attacker nor one targeted mailbox can be hammered.
    await enforceRateLimit("otpSend", `id:${identifier}`);

    const email = emailSchema.parse(identifier);

    const user = await db.user.findUnique({
      where: { email },
      select: { emailVerified: true },
    });

    // Only send to an address that actually needs this code. Without this the
    // endpoint would happily mail a code to any address on request, which is
    // an email-bombing tool.
    const shouldSend =
      purpose === OtpPurpose.EMAIL_VERIFICATION
        ? Boolean(user) && !user?.emailVerified
        : Boolean(user);

    if (shouldSend) {
      await sendOtp({ identifier: email, channel, purpose });
    }

    return apiSuccess(NEUTRAL_RESPONSE);
  } catch (error) {
    // The resend cooldown is genuinely useful feedback, so let it through
    // rather than hiding it behind the neutral response.
    return handleApiError(error, ROUTE);
  }
}
