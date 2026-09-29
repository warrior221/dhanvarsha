import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { createSupplier, listSuppliers } from "@/lib/queries/suppliers";
import { supplierFormSchema } from "@/lib/validations/supplier";

const ROUTE = "/api/admin/suppliers";

/** Admin only, like everything about suppliers. */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const search = request.nextUrl.searchParams.get("q");

    return apiSuccess(await listSuppliers(search));
  } catch (error) {
    return handleApiError(error, `GET ${ROUTE}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const input = supplierFormSchema.parse(await request.json());
    const id = await createSupplier(input);

    return apiSuccess({ id }, 201);
  } catch (error) {
    return handleApiError(error, `POST ${ROUTE}`);
  }
}
