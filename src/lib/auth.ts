import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { classifyIdentifier, loginSchema } from "@/lib/validations/auth";

/**
 * SPEC CONFLICT, AND HOW IT IS RESOLVED
 *
 * Spec section 2 asks for the Credentials provider AND database sessions.
 * Auth.js refuses that combination outright:
 *
 *   "Signing in with credentials only supported if JWT strategy is enabled"
 *   (node_modules/@auth/core/lib/utils/assert.js)
 *
 * The schema also has no Account or VerificationToken model, so the stock
 * @auth/prisma-adapter could not drive it anyway.
 *
 * What section 8.8 actually needs is revocable, database-backed sessions so
 * "log out everywhere" works. That is what this does:
 *
 *   - signing in writes a Session row (token, userAgent, ipAddress, expiry)
 *   - the JWT cookie carries only that opaque session token
 *   - EVERY session read re-checks the row; if it is gone or expired the
 *     jwt callback returns null, which clears the cookie
 *
 * So the database stays the source of truth: deleting a user's Session rows
 * logs them out everywhere, exactly as a database session strategy would.
 */

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Thrown when the password is right but the email was never verified. */
class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    // Forced by Auth.js for credentials. Revocation is handled below.
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },

  pages: {
    signIn: "/login",
  },

  trustHost: true,

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email or mobile number", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(rawCredentials, request) {
        const parsed = loginSchema.safeParse(rawCredentials);

        // Malformed input is just a failed sign-in, not a 422.
        if (!parsed.success) return null;

        const { email: identifier, password } = parsed.data;

        // Either an email address or a mobile number; both are unique.
        const who = classifyIdentifier(identifier);

        if (!who) {
          // Still burn a bcrypt compare, so "not a valid identifier" and
          // "wrong password" take a similar amount of time.
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }

        const user = await db.user.findUnique({
          where: who.kind === "email" ? { email: who.email } : { phone: who.phone },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            passwordHash: true,
            emailVerified: true,
            phoneVerified: true,
          },
        });

        // No such user, or an admin who has not set a password yet.
        // Compare against a dummy hash anyway so the response time does not
        // reveal whether the address exists.
        if (!user?.passwordHash) {
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Signing in by mobile means the number was already verified to get
        // there, so an unverified EMAIL only blocks the email route.
        if (who.kind === "email" && !user.emailVerified) {
          throw new EmailNotVerifiedError();
        }

        // Record the session so it can be listed and revoked.
        const sessionToken = newSessionToken();
        const headers = request.headers;

        const row = await db.session.create({
          data: {
            userId: user.id,
            sessionToken,
            userAgent: headers.get("user-agent")?.slice(0, 512) ?? null,
            ipAddress: ipFrom(headers),
            expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          sessionToken,
          sessionId: row.id,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      // Fresh sign-in: copy identity and the session token into the JWT.
      if (trigger === "signIn" && user) {
        token.id = user.id as string;
        token.role = user.role;
        token.sessionToken = user.sessionToken;
        token.sessionId = user.sessionId;
        return token;
      }

      // Every later read: the database decides whether this is still valid.
      if (!token.sessionToken) return null;

      const session = await db.session.findUnique({
        where: { sessionToken: token.sessionToken },
        select: { id: true, expiresAt: true, user: { select: { role: true } } },
      });

      // Revoked ("log out everywhere") or expired.
      if (!session || session.expiresAt <= new Date()) return null;

      // Pick up role changes without forcing a re-login.
      token.role = session.user.role;
      token.sessionId = session.id;

      return token;
    },

    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      // The session ROW ID, never the session token.
      //
      // /api/auth/session serves this object to anyone holding the cookie, so
      // the token itself must never be on it — that is the credential. The row
      // id is only a database key: no route accepts one from the browser, and
      // knowing it authenticates nobody. The admin MFA gate needs it to record
      // which session passed the checks.
      session.sessionId = token.sessionId;
      return session;
    },
  },

  events: {
    async signOut(message) {
      // JWT strategy gives us the decoded token here.
      const sessionToken =
        "token" in message ? message.token?.sessionToken : undefined;

      if (!sessionToken) return;

      await db.session
        .deleteMany({ where: { sessionToken } })
        .catch((error: unknown) => {
          console.error("[auth] Failed to delete session row on sign out:", error);
        });
    },
  },
});

/**
 * A real bcrypt hash of a value nobody knows, used to keep the timing of a
 * failed lookup similar to a failed password check.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO3Zx1Zx0xJ0Zr8hQ0qXW9Q8p1a2b3c4d";

function ipFrom(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return headers.get("x-real-ip")?.trim().slice(0, 64) ?? null;
}

/* ------------------------------------------------------------------ */
/* Type augmentation — keeps session.user.role typed, no `any` anywhere */
/* ------------------------------------------------------------------ */

declare module "next-auth" {
  interface User {
    role: Role;
    /** Set by authorize(), read once by the jwt callback. */
    sessionToken?: string;
    /** Session ROW id, not the token. See the session callback. */
    sessionId?: string;
  }

  interface Session {
    /** Session row id. Safe to expose; the token is not. */
    sessionId?: string;
    user: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

/**
 * Augment @auth/core/jwt, not next-auth/jwt. The latter is only
 * `export * from "@auth/core/jwt"`, and TypeScript cannot augment a module
 * that merely re-exports — the declaration has to be attached where the
 * interface actually lives.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    sessionToken?: string;
    sessionId?: string;
  }
}
