import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guards";
import { apiSuccess, handleApiError } from "@/lib/errors";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "@/lib/queries/address";
import { addressSchema, addressUpdateSchema } from "@/lib/validations/checkout";

const ROUTE = "/api/addresses";

const idSchema = z.object({ id: z.string().trim().min(1).max(64) });

/**
 * The customer address book. Every handler resolves the user first and passes
 * their id down, so an address id belonging to someone else simply is not
 * found (spec 8.11).
 */

export async function GET() {
  try {
    const user = await requireUser();
    return apiSuccess(await listAddresses(user.id));
  } catch (error) {
    return handleApiError(error, `GET ${ROUTE}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body: unknown = await request.json();
    const input = addressSchema.parse(body);

    return apiSuccess(await createAddress(user.id, input), 201);
  } catch (error) {
    return handleApiError(error, `POST ${ROUTE}`);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const body: unknown = await request.json();
    const { id, ...input } = addressUpdateSchema.parse(body);

    return apiSuccess(await updateAddress(user.id, id, input));
  } catch (error) {
    return handleApiError(error, `PUT ${ROUTE}`);
  }
}

/** Marks one address as the default. */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const body: unknown = await request.json();
    const { id } = idSchema.parse(body);

    await setDefaultAddress(user.id, id);

    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error, `PATCH ${ROUTE}`);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const body: unknown = await request.json();
    const { id } = idSchema.parse(body);

    await deleteAddress(user.id, id);

    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error, `DELETE ${ROUTE}`);
  }
}
