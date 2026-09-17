import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import {
  createAttribute,
  deleteAttribute,
  listAdminAttributes,
  updateAttribute,
} from "@/lib/queries/admin-attributes";
import { attributeSchema } from "@/lib/validations/product";

const ROUTE = "/api/admin/attributes";

const idSchema = z.object({ id: z.string().trim().min(1) });
const updateSchema = idSchema.extend({
  name: z.string().trim().min(1).max(60).optional(),
  isFilterable: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  position: z.number().int().min(0).max(999).optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    return apiSuccess(await listAdminAttributes());
  } catch (error) {
    return handleApiError(error, `GET ${ROUTE}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body: unknown = await request.json();
    const input = attributeSchema.parse(body);

    return apiSuccess(await createAttribute(input), 201);
  } catch (error) {
    return handleApiError(error, `POST ${ROUTE}`);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();

    const body: unknown = await request.json();
    const { id, ...fields } = updateSchema.parse(body);

    await updateAttribute(id, fields);

    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error, `PATCH ${ROUTE}`);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();

    const body: unknown = await request.json();
    const { id } = idSchema.parse(body);

    await deleteAttribute(id);

    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error, `DELETE ${ROUTE}`);
  }
}
