import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

export type AuthedUser = {
  id: string;
  role: Role;
  name?: string | null;
  email?: string | null;
};

/**
 * Every protected route calls one of these. Never inline an auth check, and
 * never derive the role from an email address — it comes from the `role`
 * column, surfaced through the session (spec 1.7).
 */
export async function requireUser(): Promise<AuthedUser> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AppError("UNAUTHORIZED", "Please sign in to continue.", 401);
  }

  return session.user;
}

/**
 * Admin access, including the second-factor ladder.
 *
 * The password alone is NOT enough once an authenticator app is enrolled.
 * This is the single place that decides it, so every admin page and every
 * /api/admin route inherits the rule — an admin can browse the shop as a
 * customer on an unverified session, but cost prices, supplier names and
 * profit stay out of reach until the ladder is passed.
 */
export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();

  if (user.role !== Role.ADMIN) {
    throw new AppError("FORBIDDEN", "Admin access required.", 403);
  }

  const state = await adminMfaState();

  if (state === "REQUIRED") {
    throw new AppError(
      "MFA_REQUIRED",
      "Finish the sign-in checks to continue.",
      403,
    );
  }

  return user;
}

/**
 * Admin access for a PAGE.
 *
 * Same rule as requireAdmin(), but an admin who still owes the ladder is sent
 * to the verify screen instead of being shown an error. Pages that exist to
 * GET you through the ladder — /admin/verify and /admin/security — must use
 * requireAdminForSetup() instead, or the key would be locked inside the door
 * it opens.
 */
export async function requireAdminPage(): Promise<AuthedUser> {
  const user = await requireAdminForSetup();

  // redirect() throws a control-flow signal, so it must not sit in a try.
  if ((await adminMfaState()) === "REQUIRED") redirect("/admin/verify");

  return user;
}

/** Role only. For the screens that set up or complete the second factor. */
export async function requireAdminForSetup(): Promise<AuthedUser> {
  const user = await requireUser();

  if (user.role !== Role.ADMIN) {
    throw new AppError("FORBIDDEN", "Admin access required.", 403);
  }

  return user;
}

export type AdminMfaState = "NOT_ENROLLED" | "REQUIRED" | "PASSED";

/**
 * Whether this session still owes the ladder.
 *
 * NOT_ENROLLED is deliberate: an admin who has not set up an authenticator
 * app yet must still be able to reach /admin/security to set one up. The
 * moment they confirm it, every session of theirs owes the ladder.
 */
export async function adminMfaState(): Promise<AdminMfaState> {
  const session = await auth();
  const sessionId = session?.sessionId;
  const userId = session?.user?.id;

  if (!sessionId || !userId) return "REQUIRED";

  const [row, enrolment] = await Promise.all([
    db.session.findUnique({
      where: { id: sessionId },
      select: { mfaVerifiedAt: true },
    }),
    db.adminMfa.findUnique({
      where: { userId },
      select: { totpConfirmedAt: true },
    }),
  ]);

  if (!enrolment?.totpConfirmedAt) return "NOT_ENROLLED";

  return row?.mfaVerifiedAt ? "PASSED" : "REQUIRED";
}

/** Non-throwing variant, for layouts that render differently when signed in. */
export async function getOptionalUser(): Promise<AuthedUser | null> {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}
