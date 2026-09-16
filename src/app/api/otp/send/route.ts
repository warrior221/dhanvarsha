import { OtpChannel, OtpPurpose } from "@prisma/client";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { AppError, apiSuccess, handleApiError } from "@/lib/errors";
import { sendOtp } from "@/lib/otp";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { emailSchema, otpSendSchema } from "@/lib/validations/auth";

const ROUTE = "POST /api/otp/send";

/** Which transport each purpose uses. WhatsApp is not live yet. */
const CHANNEL_FOR: Record<OtpPurpose, OtpChannel> = {
  EMAIL_VERIFICATION: OtpChannel.EMAIL,
  PASSWORD_RESET: OtpChannel.EMAIL,
  PHONE_VERIFICATION: OtpChannel.WHATSAPP,
  COD_CONFIRMATION: OtpChannel.WHATSAPP,
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

    // Rate limited per IP *and* per identifier (spec section 7), so neither
    // one attacker nor one targeted mailbox can be hammered.
    await enforceRateLimit("otpSend", ip);
    await enforceRateLimit("otpSend", `id:${identifier}`);

    const channel = CHANNEL_FOR[purpose];

    if (channel === OtpChannel.WHATSAPP) {
      throw new AppError(
        "CHANNEL_UNAVAILABLE",
        "WhatsApp verification is not available yet.",
        501,
      );
    }

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
