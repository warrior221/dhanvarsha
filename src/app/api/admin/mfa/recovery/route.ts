import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { AppError, apiSuccess, handleApiError } from "@/lib/errors";
import { useRecoveryCode } from "@/lib/queries/admin-mfa";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";

const ROUTE = "POST /api/admin/mfa/recovery";

const bodySchema = z.object({ code: z.string().trim().min(8).max(20) });

/**
 * The way back in when the phone is lost.
 *
 * Rate limited hard: a recovery code clears all three steps at once, so it is
 * the most valuable thing on this surface to guess at.
 */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit("mfaRecovery", clientIpFrom(request.headers));

    const session = await auth();
    const userId = session?.user?.id;
    const sessionId = session?.sessionId;

    if (!userId || !sessionId) {
      throw new AppError("UNAUTHORIZED", "Please sign in to continue.", 401);
    }

    if (session.user.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Admin access required.", 403);
    }

    await enforceRateLimit("mfaRecovery", `user:${userId}`);

    const { code } = bodySchema.parse(await request.json());

    await useRecoveryCode(sessionId, userId, code);

    return apiSuccess({ verified: true });
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
