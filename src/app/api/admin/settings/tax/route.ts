import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { updateTaxSettings } from "@/lib/queries/settings";
import { taxSettingsSchema } from "@/lib/validations/settings";

const ROUTE = "PUT /api/admin/settings/tax";

/** Changes the GST rate and whether displayed prices already include it. */
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();

    const body: unknown = await request.json();
    const input = taxSettingsSchema.parse(body);
    const settings = await updateTaxSettings(input);

    return apiSuccess(settings);
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
