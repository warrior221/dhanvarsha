import type { ReactElement } from "react";
import { Resend } from "resend";
import { AppError } from "@/lib/errors";

/**
 * Email transport.
 *
 * Kept deliberately thin: callers pass a subject and a React Email element.
 * The order-event notification layer (spec section 7) sits on top of this in
 * Phase 7 so adding WhatsApp later is one extra channel, not a rewrite.
 */

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;

const resend = apiKey ? new Resend(apiKey) : null;

export type SendEmailInput = {
  to: string;
  subject: string;
  react: ReactElement;
};

export async function sendEmail({ to, subject, react }: SendEmailInput): Promise<void> {
  if (!resend || !from) {
    // Deliberately NOT falling back to logging the message: OTP codes travel
    // through here and spec section 7 requires they are never logged.
    throw new AppError(
      "EMAIL_NOT_CONFIGURED",
      "Email is not configured. Set RESEND_API_KEY and EMAIL_FROM in .env.local.",
      500,
    );
  }

  const { error } = await resend.emails.send({ from, to, subject, react });

  if (error) {
    // Resend's message can name the recipient, so log it server-side only.
    console.error("[email] Resend rejected the message:", error);
    throw new AppError(
      "EMAIL_SEND_FAILED",
      "We could not send that email. Please try again in a moment.",
      502,
    );
  }
}

/** True when email can actually be sent. Used to fail fast in scripts. */
export function isEmailConfigured(): boolean {
  return Boolean(resend && from);
}
