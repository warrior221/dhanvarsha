import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. Same behaviour, new
 * filename — the handoff spec still calls it middleware.
 *
 * This is ONLY an optimistic check. Proxy runs on every request including
 * prefetches, so it must not touch the database (see the Next.js
 * authentication guide). It merely notices that no session cookie is present
 * and bounces the request to /login early.
 *
 * It is not the security boundary. Spec section 6 requires the check to be
 * layered, and the real enforcement happens where it cannot be spoofed:
 *   - (admin)/admin/layout.tsx calls requireAdmin() server-side
 *   - every /api/admin/* route calls requireAdmin() independently
 *
 * A forged cookie gets past this file and is then rejected by both of those.
 */

/** Auth.js names the cookie differently once it is served over HTTPS. */
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

const PROTECTED_PREFIXES = ["/admin", "/account", "/checkout"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected) return NextResponse.next();

  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) =>
    request.cookies.has(name),
  );

  if (hasSessionCookie) return NextResponse.next();

  const loginUrl = new URL("/login", request.nextUrl);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  /**
   * Skip Next internals, the auth endpoints themselves, and anything that
   * looks like a static file.
   */
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
