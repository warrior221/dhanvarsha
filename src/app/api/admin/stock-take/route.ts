import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import {
  abandonStocktake,
  applyCorrection,
  closeStocktake,
  countScan,
  finishCounting,
  setCount,
  skipLine,
  startStocktake,
} from "@/lib/queries/stocktake";

const ROUTE = "/api/admin/stock-take";

/**
 * One route for the whole count, because every step belongs to the same screen
 * and the same permission. `action` says which step, and the shape of the rest
 * follows from it, so a malformed request is refused before any work happens.
 */
const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({
    action: z.literal("scan"),
    stocktakeId: z.string().trim().min(1).max(64),
    barcode: z.string().trim().min(1, "Scan a tag.").max(64),
  }),
  z.object({
    action: z.literal("setCount"),
    lineId: z.string().trim().min(1).max(64),
    countedQty: z.number().int().min(0).max(9999),
  }),
  z.object({
    action: z.literal("finish"),
    stocktakeId: z.string().trim().min(1).max(64),
  }),
  z.object({
    action: z.literal("apply"),
    lineId: z.string().trim().min(1).max(64),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("skip"),
    lineId: z.string().trim().min(1).max(64),
    skip: z.boolean(),
  }),
  z.object({
    action: z.literal("close"),
    stocktakeId: z.string().trim().min(1).max(64),
  }),
  z.object({
    action: z.literal("abandon"),
    stocktakeId: z.string().trim().min(1).max(64),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = bodySchema.parse(await request.json());

    switch (body.action) {
      case "start":
        return apiSuccess(await startStocktake(admin.id, body.note));

      case "scan":
        return apiSuccess(await countScan(body.stocktakeId, body.barcode));

      case "setCount":
        await setCount(body.lineId, body.countedQty);
        return apiSuccess({ ok: true });

      case "finish":
        await finishCounting(body.stocktakeId);
        return apiSuccess({ ok: true });

      case "apply":
        return apiSuccess(await applyCorrection(body.lineId, admin.id, body.note));

      case "skip":
        await skipLine(body.lineId, body.skip);
        return apiSuccess({ ok: true });

      case "close":
        await closeStocktake(body.stocktakeId);
        return apiSuccess({ ok: true });

      case "abandon":
        await abandonStocktake(body.stocktakeId);
        return apiSuccess({ ok: true });
    }
  } catch (error) {
    return handleApiError(error, `POST ${ROUTE}`);
  }
}
