/**
 * WhatsApp delivery, through Meta's Cloud API.
 *
 * NOT ACTIVE YET, and deliberately not faked. Sending a WhatsApp message as a
 * business requires, from Meta and not from code:
 *
 *   1. a verified Meta Business account (business documents, days to weeks)
 *   2. a WhatsApp Business phone number registered to it
 *   3. a message TEMPLATE approved in advance — free-form text may only be
 *      sent inside a 24-hour window the customer opened, which never applies
 *      to a login code
 *
 * Until WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID and
 * WHATSAPP_OTP_TEMPLATE are set, isWhatsappConfigured() is false and the
 * admin login ladder SKIPS this step with a visible note rather than
 * pretending a message was sent. Filling in those three values turns the step
 * on with no code change.
 *
 * SERVER ONLY.
 */

const GRAPH_VERSION = "v21.0";
const TIMEOUT_MS = 6_000;

const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const templateName = process.env.WHATSAPP_OTP_TEMPLATE;

export function isWhatsappConfigured(): boolean {
  return Boolean(accessToken && phoneNumberId && templateName);
}

/** Why the step is unavailable, for an admin reading the screen. */
export function whatsappUnavailableReason(): string | null {
  if (isWhatsappConfigured()) return null;

  return "WhatsApp needs a verified Meta Business account and an approved message template. Until that is done this step is skipped.";
}

export type WhatsappOtpInput = {
  /** 10-digit Indian mobile, no country code. */
  phone: string;
  code: string;
};

/**
 * Sends a login code over WhatsApp.
 *
 * Throws when unconfigured: a silent no-op here would mean an admin waiting
 * for a message that was never going to arrive.
 */
export async function sendWhatsappOtp({ phone, code }: WhatsappOtpInput): Promise<void> {
  if (!isWhatsappConfigured()) {
    throw new Error("WhatsApp is not configured.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: `91${phone}`,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            {
              // Meta requires the code to be repeated in the button for an
              // authentication template.
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: code }],
            },
          ],
        },
      }),
    },
  );

  if (!response.ok) {
    // Never log the body: it contains the code and the phone number.
    throw new Error(`WhatsApp send failed with status ${response.status}`);
  }
}
