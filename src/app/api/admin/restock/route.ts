import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { findRestockCandidates, recordRestock } from "@/lib/queries/restock";
import { restockFormSchema } from "@/lib/validations/restock";

const ROUTE = "/api/admin/restock";

/** Searches for a piece the shop already has, by name or by its tag code. */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const query = request.nextUrl.searchParams.get("q") ?? "";

    return apiSuccess({ candidates: await findRestockCandidates(query) });
  } catch (error) {
    return handleApiError(error, `GET ${ROUTE}`);
  }
}

/**
 * Adds stock to pieces that already exist.
 *
 * Admin only: it writes cost prices and moves stock, and the response contains
 * cost figures that must never reach a customer.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const input = restockFormSchema.parse(await request.json());

    return apiSuccess(await recordRestock(input, admin.id), 201);
  } catch (error) {
    return handleApiError(error, `POST ${ROUTE}`);
  }
}
