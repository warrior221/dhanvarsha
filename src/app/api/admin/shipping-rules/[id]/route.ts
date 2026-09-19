import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import {
  deleteShippingRule,
  listShippingRules,
  updateShippingRule,
} from "@/lib/queries/settings";
import { shippingRuleSchema } from "@/lib/validations/settings";

const ROUTE = "/api/admin/shipping-rules/[id]";

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/admin/shipping-rules/[id]">,
) {
  try {
    await requireAdmin();

    // params is a Promise in Next.js 16.
    const { id } = await context.params;
    const body: unknown = await request.json();
    const input = shippingRuleSchema.parse(body);

    await updateShippingRule(id, input);

    return apiSuccess({ rules: await listShippingRules() });
  } catch (error) {
    return handleApiError(error, `PUT ${ROUTE}`);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/admin/shipping-rules/[id]">,
) {
  try {
    await requireAdmin();

    const { id } = await context.params;
    await deleteShippingRule(id);

    return apiSuccess({ rules: await listShippingRules() });
  } catch (error) {
    return handleApiError(error, `DELETE ${ROUTE}`);
  }
}
