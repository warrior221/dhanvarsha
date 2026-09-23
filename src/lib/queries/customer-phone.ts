import { OtpChannel, OtpPurpose } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { sendOtp, verifyOtp } from "@/lib/otp";
import { sendWhatsappOtp } from "@/lib/whatsapp";

/**
 * The customer's mobile number, and proving it reaches them.
 *
 * WHY THIS IS MANDATORY BEFORE AN ORDER: a cash-on-delivery parcel is
 * arranged by a courier who phones ahead. A number nobody answers means a
 * failed delivery, a return journey and stock tied up for a week. The email
 * address proves who the customer is; the phone number proves they can be
 * reached on the day.
 *
 * It is asked ONCE. After that it is on the account and every later order
 * goes straight through.
 */

export type PhoneStatus = {
  phone: string | null;
  verified: boolean;
  /** True when a code can actually be delivered to a phone right now. */
  canVerify: boolean;
};

export async function getPhoneStatus(userId: string): Promise<PhoneStatus> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { phone: true, phoneVerified: true },
  });

  return {
    phone: user?.phone ?? null,
    verified: Boolean(user?.phoneVerified),
    canVerify: true,
  };
}

/** Identifier the code is filed under, so it cannot be redeemed elsewhere. */
function identifierFor(phone: string): string {
  return `phone:${phone}`;
}

/**
 * Sends a code to the number, over WhatsApp.
 *
 * Deliberately NOT by email. The whole point is to prove the phone is
 * reachable; a code sent to an inbox proves nothing about the handset, and
 * would turn a real check into a box-ticking exercise.
 */
export async function startPhoneVerification(
  userId: string,
  phone: string,
): Promise<void> {
  // A number already proven on somebody else's account cannot be claimed
  // here — two accounts sharing a number makes "who do I call" ambiguous.
  const taken = await db.user.findFirst({
    where: { phone, NOT: { id: userId } },
    select: { id: true },
  });

  if (taken) {
    throw new AppError(
      "PHONE_TAKEN",
      "That number is already on another account. Sign in with it instead, or use a different number.",
      409,
    );
  }

  // sendOtp() owns the cooldown, attempt limit, hashing and expiry; this only
  // chooses where the message goes.
  await sendOtp({
    identifier: identifierFor(phone),
    channel: OtpChannel.WHATSAPP,
    purpose: OtpPurpose.PHONE_VERIFICATION,
    deliver: (code) => sendWhatsappOtp({ phone, code }),
  });
}

/** Checks the code and puts the number on the account for good. */
export async function confirmPhone(
  userId: string,
  phone: string,
  code: string,
): Promise<void> {
  await verifyOtp({
    identifier: identifierFor(phone),
    purpose: OtpPurpose.PHONE_VERIFICATION,
    code,
  });

  try {
    await db.user.update({
      where: { id: userId },
      data: { phone, phoneVerified: new Date() },
    });
  } catch {
    // The unique index is the last word: someone else may have claimed the
    // number between the check above and here.
    throw new AppError(
      "PHONE_TAKEN",
      "That number was just claimed by another account.",
      409,
    );
  }
}

/**
 * Whether this customer may place an order yet.
 *
 * Called by checkout AND by the order API, so the rule cannot be skipped by
 * posting straight to the endpoint.
 */
export async function assertCanOrder(userId: string): Promise<void> {
  const status = await getPhoneStatus(userId);

  if (!status.phone) {
    throw new AppError(
      "PHONE_REQUIRED",
      "Add a mobile number so the courier can reach you.",
      400,
    );
  }

  if (!status.verified) {
    throw new AppError(
      "PHONE_UNVERIFIED",
      "Confirm your mobile number before placing the order.",
      400,
    );
  }
}
