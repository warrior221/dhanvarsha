import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import {
  MAX_PHOTO_BYTES,
  readPhoto,
  removePhoto,
  savePhoto,
} from "@/lib/queries/supplier-photo";

const ROUTE = "/api/admin/suppliers/[id]/photo";

/**
 * The weaver's photo. Admin only, on every verb.
 *
 * GET returns the raw bytes rather than a URL, because there is no URL — the
 * image lives in the database and comes out through this guard or not at all.
 * It is marked no-store so a shared or borrowed browser does not keep a copy
 * on disk after the admin signs out.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/admin/suppliers/[id]/photo">,
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;

    // Records the viewing as part of reading it.
    const { bytes, mimeType } = await readPhoto(id, admin.id);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store, private",
        // Nothing here should ever be framed or sniffed into another type.
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    return handleApiError(error, `GET ${ROUTE}`);
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/admin/suppliers/[id]/photo">,
) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const form = await request.formData();
    const file = form.get("photo");

    if (!(file instanceof File)) {
      return handleApiError(
        new Error("No file was sent."),
        `POST ${ROUTE}`,
      );
    }

    // Checked before reading the whole thing into memory.
    if (file.size > MAX_PHOTO_BYTES) {
      return apiSuccess(
        { error: "too_large" },
        413,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    await savePhoto(id, bytes, file.type);

    return apiSuccess({ saved: true, bytes: bytes.byteLength });
  } catch (error) {
    return handleApiError(error, `POST ${ROUTE}`);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/admin/suppliers/[id]/photo">,
) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    await removePhoto(id);

    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error, `DELETE ${ROUTE}`);
  }
}
