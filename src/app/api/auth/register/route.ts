import { OtpChannel, OtpPurpose, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { AppError, apiSuccess, handleApiError } from "@/lib/errors";
import { sendOtp } from "@/lib/otp";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validations/auth";

const ROUTE = "POST /api/auth/register";
const BCRYPT_COST = 12;

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFrom(request.headers);
    await enforceRateLimit("register", ip);

    const body: unknown = await request.json();

    // Parsed, then rebuilt field by field below. `body` is never handed to
    // Prisma directly — that is how a `role: "ADMIN"` in the payload would
    // get in (spec 8.1, mass assignment).
    const { name, email, password } = registerSchema.parse(body);

    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });

    if (existing?.emailVerified) {
      throw new AppError(
        "EMAIL_TAKEN",
        "An account with this email already exists. Please sign in instead.",
        409,
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    if (existing) {
      // Registration was started but never verified. An unverified account
      // cannot be signed into, so letting the details be replaced is safe and
      // saves the shopper from being permanently stuck.
      await db.user.update({
        where: { id: existing.id },
        data: { name, passwordHash },
      });
    } else {
      await db.user.create({
        data: {
          name,
          email,
          passwordHash,
          // HARDCODED. Never read from the request body.
          role: Role.CUSTOMER,
        },
      });
    }

    await sendOtp({
      identifier: email,
      channel: OtpChannel.EMAIL,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
    });

    return apiSuccess(
      { email, message: "Check your email for a 6-digit verification code." },
      201,
    );
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
