import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { deleteSupplier, updateSupplier } from "@/lib/queries/suppliers";
import { supplierFormSchema } from "@/lib/validations/supplier";

const ROUTE = "/api/admin/suppliers/[id]";

export async function PUT(request: NextRequest, context: RouteContext<"/api/admin/suppliers/[id]">) {
  try {
    await requireAdmin();

    const { id } = await context.params;
    const input = supplierFormSchema.parse(await request.json());

    await updateSupplier(id, input);

    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error, `PUT ${ROUTE}`);
  }
}

/**
 * Removes a weaver who has never supplied anything; deactivates one who has.
 *
 * The response says which happened, so the screen can tell the truth rather
 * than claiming a deletion that did not occur.
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/admin/suppliers/[id]">,
) {
  try {
    await requireAdmin();

    const { id } = await context.params;

    return apiSuccess(await deleteSupplier(id));
  } catch (error) {
    return handleApiError(error, `DELETE ${ROUTE}`);
  }
}
