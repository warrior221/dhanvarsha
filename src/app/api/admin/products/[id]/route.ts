import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import {
  deleteProduct,
  setProductActive,
  updateProduct,
} from "@/lib/queries/admin-products";
import { productFormSchema } from "@/lib/validations/product";

const ROUTE = "/api/admin/products/[id]";

const activeSchema = z.object({ isActive: z.boolean() });

export async function PUT(
  request: NextRequest,
  context: RouteContext<"/api/admin/products/[id]">,
) {
  try {
    await requireAdmin();

    // params is a Promise in Next.js 16.
    const { id } = await context.params;
    const body: unknown = await request.json();
    const input = productFormSchema.parse(body);

    await updateProduct(id, input);

    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error, `PUT ${ROUTE}`);
  }
}

/** Quick active/inactive toggle from the product list. */
export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/admin/products/[id]">,
) {
  try {
    await requireAdmin();

    const { id } = await context.params;
    const body: unknown = await request.json();
    const { isActive } = activeSchema.parse(body);

    await setProductActive(id, isActive);

    return apiSuccess({ id, isActive });
  } catch (error) {
    return handleApiError(error, `PATCH ${ROUTE}`);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/admin/products/[id]">,
) {
  try {
    await requireAdmin();

    const { id } = await context.params;

    // Refuses when the product appears on any past order.
    return apiSuccess(await deleteProduct(id));
  } catch (error) {
    return handleApiError(error, `DELETE ${ROUTE}`);
  }
}
