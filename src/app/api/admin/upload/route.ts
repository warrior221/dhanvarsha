import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { createUploadAuth } from "@/lib/imagekit";

const ROUTE = "GET /api/admin/upload";

/**
 * Mints short-lived ImageKit upload credentials.
 *
 * Only an admin may obtain them — otherwise anyone could upload into the
 * shop's media library. The private key stays on this side; the browser only
 * ever sees a token, a signature and an expiry.
 */
export async function GET() {
  try {
    await requireAdmin();

    return apiSuccess(createUploadAuth());
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
