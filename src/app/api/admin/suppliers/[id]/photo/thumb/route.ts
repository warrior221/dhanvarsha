import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";
import { readThumb } from "@/lib/queries/supplier-photo";

const ROUTE = "/api/admin/suppliers/[id]/photo/thumb";

/**
 * The square crop shown as the face of a weaver's card.
 *
 * Still admin-guarded — there is no public route to any of this — but not
 * logged, because it loads once per card on every render of the list and
 * recording that would bury the view log in noise.
 *
 * Cached privately for a few minutes so scrolling the list does not refetch
 * every face. Private, so a shared machine's proxy never keeps a copy.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/admin/suppliers/[id]/photo/thumb">,
) {
  try {
    await requireAdmin();

    const { id } = await context.params;
    const thumb = await readThumb(id);

    if (!thumb) return new Response(null, { status: 404 });

    return new Response(new Uint8Array(thumb.bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(thumb.bytes.byteLength),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error, `GET ${ROUTE}`);
  }
}
