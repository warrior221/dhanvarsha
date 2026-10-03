import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { searchDesigns } from "@/lib/queries/admin-products";

const ROUTE = "GET /api/admin/products/search";

/**
 * Finds a product to link a colour to.
 *
 * Deliberately lean: name, code, colour and one photograph. It carries no cost
 * price, even though it is admin-only — a search box has no use for one, and the
 * fewer places cost travels the fewer places it can leak from.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const params = request.nextUrl.searchParams;

    return apiSuccess({
      matches: await searchDesigns(
        params.get("q") ?? "",
        params.get("exclude") ?? undefined,
      ),
    });
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
