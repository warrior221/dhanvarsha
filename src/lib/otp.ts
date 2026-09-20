import { randomInt } from "node:crypto";
import type { ReactElement } from "react";
import { OtpChannel, OtpPurpose } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/client";
import { OtpCodeEmail } from "@/lib/email/templates/otp-code";
import { AppError } from "@/lib/errors";

/**
 * One-time passcodes (spec section 7).
 *
 * Every rule below is enforced here, on the server:
 *   - 6 digit numeric code, from a CSPRNG (never Math.random)
 *   - bcrypt-hashed before storage, never logged
 *   - 10 minute expiry
 *   - at most 5 attempts, then the code is burned
 *   - single use (consumedAt)
 *   - 60 second resend cooldown
 *
 * Per-identifier and per-IP rate limiting sits in the route handlers, which
 * know the caller's IP.
 */

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

const BCRYPT_COST = 12;

/** Cryptographically uniform 6-digit code, zero padded. */
function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export type SendOtpInput = {
  identifier: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
};

/**
 * Issues a code and delivers it. Any previously issued, still-live code for
 * the same identifier+purpose is burned first, so only the newest works.
 */
export async function sendOtp({ identifier, channel, purpose }: SendOtpInput): Promise<void> {
  const now = new Date();

  // 60 second resend cooldown.
  const latest = await db.otpCode.findFirst({
    where: { identifier, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (latest) {
    const elapsedSeconds = (now.getTime() - latest.createdAt.getTime()) / 1000;

    if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      throw new AppError(
        "OTP_COOLDOWN",
        `Please wait ${wait} more second${wait === 1 ? "" : "s"} before requesting another code.`,
        429,
      );
    }
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_COST);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60_000);

  // Burn any outstanding codes, then issue the new one, atomically.
  await db.$transaction([
    db.otpCode.updateMany({
      where: { identifier, purpose, consumedAt: null },
      data: { consumedAt: now },
    }),
    db.otpCode.create({
      data: { identifier, channel, purpose, codeHash, expiresAt },
    }),
  ]);

  await deliver({ identifier, channel, purpose, code });
}

type DeliverInput = SendOtpInput & { code: string };

/**
 * Channel dispatch. EMAIL works today; WHATSAPP is deferred until Meta
 * Business verification, and SMS until TRAI DLT registration. Adding one is a
 * new case here, nothing else changes.
 */
async function deliver({ identifier, channel, purpose, code }: DeliverInput): Promise<void> {
  switch (channel) {
    case OtpChannel.EMAIL:
      await sendCodeEmail({
        to: identifier,
        subject: `${code} is your Dhanvarsha verification code`,
        code,
        react: OtpCodeEmail({ code, expiryMinutes: OTP_EXPIRY_MINUTES, purpose }),
      });
      return;

    case OtpChannel.WHATSAPP:
      throw new AppError(
        "CHANNEL_UNAVAILABLE",
        "WhatsApp delivery is not available yet.",
        501,
      );
  }
}

/**
 * Sends a message that CONTAINS A CODE, with the development fallback.
 *
 * Every code-bearing email must go through here, not straight to sendEmail.
 * Resend's free tier refuses every recipient except the account owner, so a
 * direct call locks that flow out of testing entirely — which is exactly how
 * the admin sign-in ladder was briefly unusable.
 *
 * In production a failed send is still a failed send and throws.
 */
export async function sendCodeEmail({
  to,
  subject,
  code,
  react,
}: {
  to: string;
  subject: string;
  code: string;
  react: ReactElement;
}): Promise<void> {
  try {
    await sendEmail({ to, subject, react });
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error;

    printDevelopmentFallback(to, code, error);
  }
}

/**
 * Development-only escape hatch. Never called when NODE_ENV is "production".
 *
 * Deliberately loud: a code on a terminal is a code someone could read over a
 * shoulder, so the banner says plainly that this is not how the live shop
 * behaves.
 */
function printDevelopmentFallback(
  identifier: string,
  code: string,
  error: unknown,
): void {
  const reason = error instanceof Error ? error.message : "unknown error";

  console.warn(
    [
      "",
      "┌──────────────────────────────────────────────────────────────┐",
      "│  EMAIL FAILED — showing the code here so you can carry on.   │",
      "│  This happens in development only. Verify a domain at        │",
      "│  resend.com/domains and real customers will get the email.   │",
      "└──────────────────────────────────────────────────────────────┘",
      `  for:  ${identifier}`,
      `  code: ${code}`,
      `  why:  ${reason}`,
      "",
    ].join("\n"),
  );
}

export type VerifyOtpInput = {
  identifier: string;
  purpose: OtpPurpose;
  code: string;
};

/**
 * Consumes a code. Throws unless it matches a live, unexpired, unconsumed
 * code with attempts remaining.
 *
 * Messages are deliberately vague about which condition failed so the
 * endpoint cannot be used to probe which identifiers exist.
 */
export async function verifyOtp({ identifier, purpose, code }: VerifyOtpInput): Promise<void> {
  const now = new Date();

  const record = await db.otpCode.findFirst({
    where: { identifier, purpose, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    throw new AppError(
      "OTP_INVALID",
      "That code is invalid or has expired. Please request a new one.",
      400,
    );
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    // Burn it so it cannot be ground down further.
    await db.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: now },
    });

    throw new AppError(
      "OTP_INVALID",
      "Too many incorrect attempts. Please request a new code.",
      400,
    );
  }

  const matches = await bcrypt.compare(code, record.codeHash);

  if (!matches) {
    await db.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });

    const remaining = OTP_MAX_ATTEMPTS - (record.attempts + 1);

    throw new AppError(
      "OTP_INVALID",
      remaining > 0
        ? `That code is not correct. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
        : "That code is not correct. Please request a new code.",
      400,
    );
  }

  // Single use: consume it. The conditional where guards against two requests
  // racing to redeem the same code.
  const consumed = await db.otpCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: now },
  });

  if (consumed.count === 0) {
    throw new AppError(
      "OTP_INVALID",
      "That code has already been used. Please request a new one.",
      400,
    );
  }
}
