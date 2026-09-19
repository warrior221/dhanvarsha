import { INDIAN_STATES } from "@/lib/validations/checkout";

/**
 * PIN code lookup types and state-name normalisation.
 *
 * PURE MODULE — no database import, so the address form can use it.
 *
 * India Post and OpenStreetMap both return state names that do not match our
 * dropdown: "Pondicherry" for Puducherry, "Chattisgarh" (one h) for
 * Chhattisgarh, "Jammu & Kashmir" with an ampersand. An unmatched state would
 * silently leave the field blank, so every name is mapped here.
 */

export type PincodeLookup = {
  pincode: string;
  city: string;
  /** Always one of INDIAN_STATES, or "" when it could not be matched. */
  state: string;
  /** Localities in this PIN code, offered as suggestions. */
  areas: string[];
};

export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

export function isCompletePincode(value: string): boolean {
  return PINCODE_PATTERN.test(value.trim());
}

/** Lowercase, "&" spelled out, punctuation and spaces removed. */
function canonical(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z]/g, "");
}

/** Names the sources actually return that our canonical form does not match. */
const ALIASES: Record<string, (typeof INDIAN_STATES)[number]> = {
  pondicherry: "Puducherry",
  chattisgarh: "Chhattisgarh",
  orissa: "Odisha",
  uttaranchal: "Uttarakhand",
  andamanandnicobar: "Andaman and Nicobar Islands",
  andamanandnicobarisland: "Andaman and Nicobar Islands",
  damananddiu: "Dadra and Nagar Haveli and Daman and Diu",
  dadraandnagarhaveli: "Dadra and Nagar Haveli and Daman and Diu",
  nctofdelhi: "Delhi",
  delhinct: "Delhi",
  nationalcapitalterritoryofdelhi: "Delhi",
};

const BY_CANONICAL = new Map<string, string>(
  INDIAN_STATES.map((state) => [canonical(state), state]),
);

/**
 * Maps a state name from an outside source onto our dropdown.
 *
 * Returns "" rather than guessing when there is no match — leaving the field
 * empty for the customer to choose is better than filling in the wrong state
 * and having a parcel routed to it.
 */
export function normaliseState(raw: string | null | undefined): string {
  if (!raw) return "";

  const key = canonical(raw);

  return BY_CANONICAL.get(key) ?? ALIASES[key] ?? "";
}
