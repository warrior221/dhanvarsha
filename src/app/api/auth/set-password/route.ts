import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, apiSuccess, handleApiError } from "@/lib/errors";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { setPasswordSchema } from "@/lib/validations/auth";

const ROUTE = "POST /api/auth/set-password";
const BCRYPT_COST = 12;

const bodySchema = z
  .object({ token: z.string().min(1) })
  .and(setPasswordSchema);

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFrom(request.headers);
    await enforceRateLimit("setPassword", ip);

    const body: unknown = await request.json();
    const { token, password } = bodySchema.parse(body);

    // Stored as SHA-256 so the token can be looked up directly. The token
    // itself is 256 bits of randomness, so a fast hash is not a weakness.
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const setupToken = await db.setupToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    const invalid = new AppError(
      "SETUP_TOKEN_INVALID",
      "This setup link is invalid or has already been used. Ask for a new one.",
      400,
    );

    if (!setupToken || setupToken.usedAt) throw invalid;
    if (setupToken.expiresAt <= new Date()) {
      throw new AppError(
        "SETUP_TOKEN_EXPIRED",
        "This setup link has expired. Ask for a new one.",
        400,
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    // Burn the token and set the password together. The conditional update
    // means two concurrent submissions cannot both succeed.
    const [claimed] = await db.$transaction([
      db.setupToken.updateMany({
        where: { id: setupToken.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      db.user.update({
        where: { id: setupToken.userId },
        data: { passwordHash, emailVerified: new Date() },
      }),
    ]);

    if (claimed.count === 0) throw invalid;

    return apiSuccess({ message: "Password set. You can sign in now." });
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
