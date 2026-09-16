import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
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

export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();

  if (user.role !== Role.ADMIN) {
    throw new AppError("FORBIDDEN", "Admin access required.", 403);
  }

  return user;
}

/** Non-throwing variant, for layouts that render differently when signed in. */
export async function getOptionalUser(): Promise<AuthedUser | null> {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}
