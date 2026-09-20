import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { AppError, apiSuccess, handleApiError } from "@/lib/errors";
import { getChallengeState, sendStepCode, verifyStep } from "@/lib/queries/admin-mfa";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";

const ROUTE = "POST /api/admin/mfa/challenge";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send") }),
  z.object({ action: z.literal("verify"), code: z.string().trim().min(1).max(10) }),
]);

/**
 * Walking the three steps.
 *
 * Which step is current is decided HERE from the stored challenge, never from
 * anything the browser claims. A request cannot skip ahead by asserting that
 * earlier steps are done.
 */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit("mfaChallenge", clientIpFrom(request.headers));

    const session = await auth();
    const userId = session?.user?.id;
    const sessionId = session?.sessionId;

    if (!userId || !sessionId) {
      throw new AppError("UNAUTHORIZED", "Please sign in to continue.", 401);
    }

    if (session.user.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "Admin access required.", 403);
    }

    const body: unknown = await request.json();
    const input = bodySchema.parse(body);

    if (input.action === "send") {
      const sent = await sendStepCode(sessionId, userId);
      const state = await getChallengeState(sessionId, userId);

      return apiSuccess({ ...state, sentTo: sent.sentTo });
    }

    const state = await verifyStep(sessionId, userId, input.code);

    return apiSuccess(state);
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
