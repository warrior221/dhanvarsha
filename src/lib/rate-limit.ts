import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { AppError } from "@/lib/errors";

/**
 * Rate limiting for the endpoints an attacker would hammer: login,
 * registration, OTP send/verify, checkout and COD placement (spec 8.6).
 *
 * FAILURE MODE: if Upstash is not configured we allow requests in
 * development (so the app runs before the account exists) but refuse to start
 * in production. Silently disabling rate limiting on a live shop would be a
 * security hole that nothing surfaces.
 */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const isConfigured = Boolean(url && token);

/**
 * The production check happens per REQUEST, not at module load.
 *
 * `next build` runs with NODE_ENV=production and evaluates route modules to
 * collect page data, so throwing at import time would break every build on a
 * machine without Upstash credentials. Building without secrets is normal —
 * they are injected at runtime. Serving traffic without them is not.
 */
let warned = false;

function warnOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(
    "[rate-limit] Upstash is not configured — rate limiting is DISABLED. " +
      "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local.",
  );
}

const redis = isConfigured ? new Redis({ url: url!, token: token! }) : null;

/** Tuning per endpoint. Windows are deliberately short and strict. */
const RULES = {
  login: { tokens: 8, window: "10 m" },
  register: { tokens: 5, window: "60 m" },
  otpSend: { tokens: 5, window: "60 m" },
  otpVerify: { tokens: 10, window: "10 m" },
  setPassword: { tokens: 10, window: "60 m" },
  resetPassword: { tokens: 10, window: "60 m" },
  /** Generous: a customer types, corrects and retypes a PIN code. */
  pincode: { tokens: 40, window: "10 m" },
  /** Tighter: each one can reach OpenStreetMap, whose policy forbids bulk use. */
  geocode: { tokens: 10, window: "10 m" },
  mfaEnrol: { tokens: 20, window: "60 m" },
  /** Three steps, each with sends and retries, so not too mean. */
  mfaChallenge: { tokens: 40, window: "15 m" },
  /** A recovery code clears all three steps, so guessing must be expensive. */
  mfaRecovery: { tokens: 5, window: "60 m" },
  checkout: { tokens: 20, window: "10 m" },
  codOrder: { tokens: 5, window: "60 m" },
} as const satisfies Record<string, { tokens: number; window: `${number} ${"s" | "m" | "h"}` }>;

export type RateLimitRule = keyof typeof RULES;

const limiters = new Map<RateLimitRule, Ratelimit>();

function limiterFor(rule: RateLimitRule): Ratelimit | null {
  if (!redis) return null;

  const existing = limiters.get(rule);
  if (existing) return existing;

  const { tokens, window } = RULES[rule];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix: `dhanvarsha:${rule}`,
    analytics: false,
  });

  limiters.set(rule, limiter);
  return limiter;
}

/**
 * Throws AppError(429) when the caller has run out of budget.
 *
 * `key` should identify the actor as precisely as possible — an IP for
 * anonymous endpoints, or `${ip}:${email}` where a specific account is being
 * targeted, so one attacker cannot lock out every user from one address.
 */
export async function enforceRateLimit(rule: RateLimitRule, key: string): Promise<void> {
  const limiter = limiterFor(rule);

  if (!limiter) {
    // Refuse to serve a real request with rate limiting silently off.
    if (process.env.NODE_ENV === "production") {
      throw new AppError(
        "RATE_LIMIT_UNAVAILABLE",
        "This service is temporarily unavailable. Please try again shortly.",
        503,
      );
    }

    warnOnce();
    return;
  }

  const { success, reset } = await limiter.limit(key);

  if (!success) {
    const seconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    throw new AppError(
      "RATE_LIMITED",
      `Too many attempts. Please try again in ${formatWait(seconds)}.`,
      429,
    );
  }
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

/**
 * Best-effort client IP. Behind Vercel/proxies the socket address is the
 * proxy, so the forwarded headers are used first.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
