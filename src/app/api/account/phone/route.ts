import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import {
  confirmPhone,
  getPhoneStatus,
  savePhoneUnverified,
  startPhoneVerification,
} from "@/lib/queries/customer-phone";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { phoneSchema } from "@/lib/validations/auth";

const ROUTE = "/api/account/phone";

const sendSchema = z.object({ phone: phoneSchema });
const confirmSchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

/**
 * Takes the customer's number.
 *
 * Normally that means sending a WhatsApp code. While WhatsApp is unavailable
 * the number is simply recorded, unproven, because a courier still needs
 * something to ring and there is no channel to prove it on. `sentTo` is null
 * in that case, which is how the screen knows not to ask for a code.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    // Rate limited either way: this writes to an account and checks a number
    // against every other one, whether or not a message follows.
    await enforceRateLimit("otpSend", clientIpFrom(request.headers));
    await enforceRateLimit("otpSend", `user:${user.id}`);

    const { phone } = sendSchema.parse(await request.json());
    const { canVerify } = await getPhoneStatus(user.id);

    if (!canVerify) {
      await savePhoneUnverified(user.id, phone);
      return apiSuccess({ sentTo: null });
    }

    await startPhoneVerification(user.id, phone);

    return apiSuccess({ sentTo: `•••••${phone.slice(-5)}` });
  } catch (error) {
    return handleApiError(error, `POST ${ROUTE}`);
  }
}

/** Checks the code and saves the number to the account for good. */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();

    await enforceRateLimit("otpVerify", clientIpFrom(request.headers));
    await enforceRateLimit("otpVerify", `user:${user.id}`);

    const { phone, code } = confirmSchema.parse(await request.json());

    await confirmPhone(user.id, phone, code);

    return apiSuccess(await getPhoneStatus(user.id));
  } catch (error) {
    return handleApiError(error, `PUT ${ROUTE}`);
  }
}
