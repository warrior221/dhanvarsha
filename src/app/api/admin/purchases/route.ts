import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { recordPurchase } from "@/lib/queries/purchases";
import { purchaseFormSchema } from "@/lib/validations/purchase";

const ROUTE = "POST /api/admin/purchases";

/** Checks a delivery in. Admin only — it writes cost prices and stock. */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const input = purchaseFormSchema.parse(await request.json());

    return apiSuccess(await recordPurchase(input, admin.id), 201);
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
