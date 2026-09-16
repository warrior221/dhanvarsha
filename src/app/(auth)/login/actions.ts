"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { mergeGuestDataIntoUser } from "@/lib/cart-merge";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { clearGuestSessionId, getGuestSessionId } from "@/lib/session";
import { loginSchema } from "@/lib/validations/auth";

export type LoginState = {
  error?: string;
  /** Set when the account exists but the email was never verified. */
  unverifiedEmail?: string;
};

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter your email address and password." };
  }

  const { email, password } = parsed.data;
  const callbackUrl = asSafePath(formData.get("callbackUrl"));

  try {
    const requestHeaders = await headers();
    const ip = clientIpFrom(requestHeaders);

    // Limited per IP and per account, so one attacker cannot lock out an
    // entire address range, nor grind a single account.
    await enforceRateLimit("login", ip);
    await enforceRateLimit("login", `account:${email}`);

    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message };
    }

    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        // Thrown by authorize() when the password was right but the address
        // was never confirmed.
        if ("code" in error && error.code === "email_not_verified") {
          return {
            error: "Please verify your email address before signing in.",
            unverifiedEmail: email,
          };
        }
      }

      return { error: "That email or password is not correct." };
    }

    throw error;
  }

  // Signed in. Carry anything added as a guest across to the account.
  await mergeGuestCart(email);

  redirect(callbackUrl);
}

/**
 * Moves the guest cart and wishlist onto the account, then drops the guest
 * cookie. A failure here must not block the login that already succeeded, so
 * it is logged rather than thrown.
 */
async function mergeGuestCart(email: string): Promise<void> {
  try {
    const guestSessionId = await getGuestSessionId();
    if (!guestSessionId) return;

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) return;

    await mergeGuestDataIntoUser(guestSessionId, user.id);
    await clearGuestSessionId();
  } catch (error) {
    console.error("[login] Guest cart merge failed:", error);
  }
}

/**
 * Only ever redirect to a path on this site. Without this check a crafted
 * ?callbackUrl=https://evil.example would make the login form an open
 * redirect.
 */
function asSafePath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
