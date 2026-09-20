import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { AppError, apiSuccess, handleApiError } from "@/lib/errors";
import {
  beginTotpEnrolment,
  confirmTotpEnrolment,
  disableMfa,
  setWhatsappNumber,
} from "@/lib/queries/admin-mfa";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { formatSecretForReading, totpUri } from "@/lib/totp";
import { phoneSchema } from "@/lib/validations/auth";

const ROUTE = "POST /api/admin/mfa/enrol";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin") }),
  z.object({ action: z.literal("confirm"), code: z.string().trim().min(1).max(10) }),
  z.object({ action: z.literal("disable"), code: z.string().trim().min(1).max(10) }),
  z.object({ action: z.literal("whatsapp"), phone: phoneSchema }),
]);

/**
 * Setting up the admin second factor.
 *
 * Guarded by requireUser + an explicit ADMIN role check rather than
 * requireAdmin(), because requireAdmin() now demands the very ladder this
 * route exists to set up — using it here would be a locked door with the key
 * behind it.
 */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit("mfaEnrol", clientIpFrom(request.headers));

    const session = await auth();
    const user = session?.user;

    if (!user?.id) {
      throw new AppError("UNAUTHORIZED", "Please sign in to continue.", 401);
    }

    if (user.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Admin access required.", 403);
    }

    const body: unknown = await request.json();
    const input = bodySchema.parse(body);

    if (input.action === "begin") {
      const secret = await beginTotpEnrolment(user.id);

      // Rendered on our own server: the secret never travels to a QR service.
      const uri = totpUri(secret, user.email ?? "admin");
      const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 240 });

      return apiSuccess({
        qrDataUrl,
        manualKey: formatSecretForReading(secret),
      });
    }

    if (input.action === "confirm") {
      const recoveryCodes = await confirmTotpEnrolment(user.id, input.code);

      // Shown once, never retrievable again — only hashes are stored.
      return apiSuccess({ recoveryCodes });
    }

    if (input.action === "disable") {
      await disableMfa(user.id, input.code);
      return apiSuccess({ disabled: true });
    }

    await setWhatsappNumber(user.id, input.phone);

    return apiSuccess({ phone: input.phone });
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
