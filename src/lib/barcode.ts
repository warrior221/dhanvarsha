import { randomInt } from "node:crypto";

/**
 * The code printed on a piece's tag and scanned at the counter.
 *
 * NOT the SKU. A SKU is a label the shop writes and may reword; a barcode is
 * ink on a tag tied to a saree in a pile, and the day it changes every tag
 * already printed becomes wrong. So it is generated once, stored, and never
 * edited.
 *
 * Code 128 is the symbology: it takes letters and digits, prints narrow, and
 * needs no registration for use inside one shop. (A GTIN would have to be
 * bought from GS1 and only matters for selling through someone else's till.)
 *
 * The alphabet is Crockford base32 — no I, L, O or U — so a code read aloud
 * down the phone, or typed in by hand when a scanner will not read a creased
 * tag, cannot be confused between 1/I/L or 0/O.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Marks the code as this shop's, and keeps it from starting with a digit. */
const PREFIX = "DV";

/** 9 characters from a 32-letter alphabet: 32^9, about 3.5 x 10^13 codes. */
const BODY_LENGTH = 9;

export function generateBarcode(): string {
  let body = "";

  for (let i = 0; i < BODY_LENGTH; i++) {
    body += ALPHABET[randomInt(ALPHABET.length)];
  }

  return `${PREFIX}${body}`;
}

/** Shape check only — says nothing about whether the code exists. */
export function looksLikeBarcode(value: string): boolean {
  const trimmed = value.trim().toUpperCase();

  if (!trimmed.startsWith(PREFIX)) return false;
  if (trimmed.length !== PREFIX.length + BODY_LENGTH) return false;

  return [...trimmed.slice(PREFIX.length)].every((char) => ALPHABET.includes(char));
}

/**
 * What a scanner typed, cleaned up.
 *
 * USB scanners act as keyboards: they type the code and press Enter. They can
 * add whitespace, and a hand-typed code arrives in whatever case the person
 * used.
 */
export function normaliseScan(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}
