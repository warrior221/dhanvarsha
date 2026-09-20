import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238), as used by Google Authenticator,
 * Microsoft Authenticator, Authy and 1Password.
 *
 * Written out rather than pulled from a package: it is about sixty lines of
 * well-specified arithmetic, and RFC 6238 publishes official test vectors, so
 * it can be proved correct rather than trusted. One fewer dependency in the
 * path of the shop's own login is worth having.
 *
 * SERVER ONLY — node:crypto.
 */

const DIGITS = 6;
const PERIOD_SECONDS = 30;

/**
 * How many 30-second steps either side of now are accepted.
 *
 * 1 means a code stays valid for about 90 seconds. Phone clocks drift, and
 * someone reading a code aloud off a screen is slower than you think; 0 would
 * lock out honest admins, and a wider window meaningfully lengthens the guess
 * window for an attacker.
 */
const DRIFT_STEPS = 1;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** A fresh 20-byte secret, base32 encoded the way authenticator apps expect. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];

  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const character of clean) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index === -1) throw new Error("Invalid base32 character in TOTP secret.");

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** The code for one 30-second step. */
export function totpAt(secret: string, counter: number): string {
  const key = base32Decode(secret);

  // 8-byte big-endian counter.
  const message = Buffer.alloc(8);
  message.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  message.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", key).update(message).digest();

  // Dynamic truncation, RFC 4226 section 5.4.
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/**
 * Checks a code the admin typed, allowing for clock drift.
 *
 * Compared with timingSafeEqual so the answer cannot be narrowed down by
 * measuring how long the comparison took.
 */
export function verifyTotp(
  secret: string,
  code: string,
  now: Date = new Date(),
): boolean {
  const cleaned = code.trim().replace(/\s/g, "");

  if (!/^\d{6}$/.test(cleaned)) return false;

  const counter = Math.floor(now.getTime() / 1000 / PERIOD_SECONDS);
  const supplied = Buffer.from(cleaned);

  for (let drift = -DRIFT_STEPS; drift <= DRIFT_STEPS; drift += 1) {
    const expected = Buffer.from(totpAt(secret, counter + drift));

    if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) {
      return true;
    }
  }

  return false;
}

/**
 * The otpauth:// URI an authenticator app reads from a QR code.
 *
 * The label and issuer both carry the shop name so the entry is recognisable
 * among a dozen others in the app.
 */
export function totpUri(secret: string, accountEmail: string): string {
  const issuer = "Dhanvarsha";
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Groups the secret into fours, for an admin typing it in by hand. */
export function formatSecretForReading(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}
