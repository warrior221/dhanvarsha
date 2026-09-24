import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { createProduct, listAdminProducts } from "@/lib/queries/admin-products";
import { productFormSchema } from "@/lib/validations/product";

const ROUTE = "/api/admin/products";

export async function GET(request: NextRequest) {
  try {
    // Guards independently of the layout and of proxy.ts (spec section 6).
    await requireAdmin();

    const params = request.nextUrl.searchParams;

    return apiSuccess(
      await listAdminProducts({
        q: params.get("q"),
        categoryId: params.get("categoryId"),
        status: params.get("status"),
        soldOutOnly: params.get("soldOut") === "1",
        page: Number(params.get("page") ?? "1") || 1,
      }),
    );
  } catch (error) {
    return handleApiError(error, `GET ${ROUTE}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body: unknown = await request.json();
    // Parsed, then handed to a function that builds the insert field by field.
    // The raw body never reaches Prisma (spec 8.1).
    const input = productFormSchema.parse(body);

    const id = await createProduct(input);

    return apiSuccess({ id }, 201);
  } catch (error) {
    return handleApiError(error, `POST ${ROUTE}`);
  }
}
