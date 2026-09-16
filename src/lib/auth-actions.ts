"use server";

import { signOut } from "@/lib/auth";

/**
 * Signing out deletes the Session row via the `signOut` event in auth.ts, so
 * the token is dead server-side and not merely forgotten by the browser.
 */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
