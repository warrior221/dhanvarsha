import { getOptionalUser } from "@/lib/auth-guards";
import { ensureGuestSessionId, getGuestSessionId } from "@/lib/session";

/**
 * Who is shopping: a signed-in user, or a guest identified by the httpOnly
 * cookie. Cart and wishlist rows hang off one or the other, never both.
 *
 * On login the guest rows are merged into the account and deleted — see
 * src/lib/cart-merge.ts.
 */
export type Shopper =
  | { kind: "user"; userId: string }
  | { kind: "guest"; sessionId: string };

/**
 * Resolves the current shopper.
 *
 * `create: true` will mint a guest cookie if there is not one yet, so it may
 * only be called from a Route Handler or Server Action — cookies cannot be
 * written during a Server Component render. Read paths pass `create: false`
 * (the default) and get null when there is nothing to look up.
 */
// Overloads so `create: true` is typed as always producing a Shopper. Without
// them every caller would need a non-null assertion.
export async function resolveShopper(options: { create: true }): Promise<Shopper>;
export async function resolveShopper(
  options?: { create?: false },
): Promise<Shopper | null>;
export async function resolveShopper(
  { create = false }: { create?: boolean } = {},
): Promise<Shopper | null> {
  const user = await getOptionalUser();

  if (user) return { kind: "user", userId: user.id };

  const existing = await getGuestSessionId();
  if (existing) return { kind: "guest", sessionId: existing };

  if (!create) return null;

  return { kind: "guest", sessionId: await ensureGuestSessionId() };
}
