import { randomInt } from "node:crypto";

/**
 * Human-readable order numbers, e.g. DV-260919-K7M2X.
 *
 * These get read out over the phone when a customer rings about an order, so
 * the alphabet leaves out characters that sound or look alike: 0/O, 1/I/L,
 * 5/S, 8/B. The date prefix makes it obvious at a glance when an order was
 * placed.
 *
 * Uniqueness is guaranteed by the unique index on Order.orderNumber; this only
 * has to make collisions rare enough that a retry almost never happens.
 */

const ALPHABET = "234679ACDEFGHJKMNPQRTUVWXYZ";
const SUFFIX_LENGTH = 5;

export function generateOrderNumber(now = new Date()): string {
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += ALPHABET[randomInt(0, ALPHABET.length)];
  }

  return `DV-${year}${month}${day}-${suffix}`;
}
