import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { lookupByBarcode, scanOut, undoScan } from "@/lib/queries/scan-out";

const ROUTE = "/api/admin/scan-out";

const scanSchema = z.object({
  barcode: z.string().trim().min(1, "Scan a tag.").max(64),
  /** True to look the piece up without taking it out of stock. */
  preview: z.boolean().default(false),
});

const undoSchema = z.object({
  movementId: z.string().trim().min(1).max(64),
  note: z.string().trim().min(3, "Say why it is going back.").max(500),
});

/** Scans a piece out, or looks one up when `preview` is set. */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const { barcode, preview } = scanSchema.parse(await request.json());

    if (preview) return apiSuccess({ piece: await lookupByBarcode(barcode) });

    return apiSuccess(await scanOut(barcode, admin.id));
  } catch (error) {
    return handleApiError(error, `POST ${ROUTE}`);
  }
}

/** Puts a scanned piece back, leaving both movements in the history. */
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const { movementId, note } = undoSchema.parse(await request.json());

    return apiSuccess(await undoScan(movementId, admin.id, note));
  } catch (error) {
    return handleApiError(error, `PUT ${ROUTE}`);
  }
}
