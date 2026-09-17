import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import {
  createAttributeValue,
  deleteAttributeValue,
} from "@/lib/queries/admin-attributes";
import { attributeValueSchema } from "@/lib/validations/product";

const ROUTE = "/api/admin/attributes/values";

const idSchema = z.object({ id: z.string().trim().min(1) });

/**
 * Creates a value. Called both by the attribute manager and by the "add new"
 * box inside the product form, so a new option can be invented mid-product
 * without leaving the page.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body: unknown = await request.json();
    const input = attributeValueSchema.parse(body);

    const value = await createAttributeValue(input);

    return apiSuccess(value, value.created ? 201 : 200);
  } catch (error) {
    return handleApiError(error, `POST ${ROUTE}`);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();

    const body: unknown = await request.json();
    const { id } = idSchema.parse(body);

    await deleteAttributeValue(id);

    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error, `DELETE ${ROUTE}`);
  }
}
