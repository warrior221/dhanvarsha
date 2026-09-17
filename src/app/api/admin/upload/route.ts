import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import { signUploadParams } from "@/lib/cloudinary";
import { handleApiError } from "@/lib/errors";

const ROUTE = "POST /api/admin/upload";

/**
 * next-cloudinary's upload widget posts the parameters it intends to send and
 * expects a signature back. Values are constrained to strings/numbers so a
 * crafted payload cannot smuggle structures into the signed request.
 */
const bodySchema = z.object({
  paramsToSign: z.record(
    z.string(),
    z.union([z.string(), z.number()]).transform(String),
  ),
});

export async function POST(request: NextRequest) {
  try {
    // Only an admin may obtain an upload signature; otherwise anyone could
    // upload into the shop's Cloudinary account.
    await requireAdmin();

    const body: unknown = await request.json();
    const { paramsToSign } = bodySchema.parse(body);

    const signature = signUploadParams(paramsToSign);

    // The widget expects this exact shape, not our usual { data } envelope.
    return Response.json({ signature });
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
