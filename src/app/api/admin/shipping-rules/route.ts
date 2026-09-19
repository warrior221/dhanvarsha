import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { createShippingRule, listShippingRules } from "@/lib/queries/settings";
import { shippingRuleSchema } from "@/lib/validations/settings";

const ROUTE = "POST /api/admin/shipping-rules";

/** Adds a delivery-charge tier. */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body: unknown = await request.json();
    const input = shippingRuleSchema.parse(body);

    await createShippingRule(input);

    return apiSuccess({ rules: await listShippingRules() }, 201);
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
