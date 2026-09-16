import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Guest identity.
 *
 * Guests can browse, add to cart and add to wishlist without an account.
 * Those rows are keyed to this cookie. On login or registration the guest
 * rows are merged into the user's own and deleted (see cart-merge.ts).
 *
 * NOTE ON THE ID FORMAT: the spec calls for a cuid. cuid v1 is monotonic and
 * only partly random, so it is guessable. Whoever holds this value can read
 * and modify that guest's cart, so it is generated from a CSPRNG instead.
 */
export const GUEST_SESSION_COOKIE = "sessionId";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

function newGuestSessionId(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Reads the guest id if one exists. Safe to call anywhere, including during
 * a Server Component render.
 */
export async function getGuestSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(GUEST_SESSION_COOKIE)?.value ?? null;
}

/**
 * Reads the guest id, creating and setting one if absent.
 *
 * Cookies can only be written from a Route Handler or Server Action, so this
 * must not be called during a Server Component render — use
 * getGuestSessionId() there.
 */
export async function ensureGuestSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(GUEST_SESSION_COOKIE)?.value;

  if (existing) return existing;

  const id = newGuestSessionId();

  store.set(GUEST_SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS,
  });

  return id;
}

/** Called after a guest cart has been merged into a real account. */
export async function clearGuestSessionId(): Promise<void> {
  const store = await cookies();
  store.delete(GUEST_SESSION_COOKIE);
}
