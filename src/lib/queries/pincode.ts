import { db } from "@/lib/db";
import { isCompletePincode, normaliseState, type PincodeLookup } from "@/lib/pincode";

/**
 * PIN code → city and state, via India Post, cached in our own database.
 *
 * The first customer to use a PIN code pays for the outside call; everyone
 * after that is served from Postgres. A shop sells into the same few hundred
 * PIN codes, so the cache fills quickly and the dependency on a free public
 * API fades.
 *
 * Every failure returns null. The address form falls back to being typed by
 * hand, which is what it was before — an autofill that cannot reach the
 * internet must not block a sale.
 */

const INDIA_POST = "https://api.postalpincode.in/pincode";
const TIMEOUT_MS = 4_000;

type IndiaPostOffice = {
  Name?: string;
  District?: string;
  State?: string;
  Block?: string;
};

type IndiaPostReply = {
  Status?: string;
  PostOffice?: IndiaPostOffice[] | null;
};

export async function lookupPincode(pincode: string): Promise<PincodeLookup | null> {
  const pin = pincode.trim();

  if (!isCompletePincode(pin)) return null;

  const cached = await db.pincodeArea.findUnique({ where: { pincode: pin } });

  if (cached) {
    return {
      pincode: cached.pincode,
      city: cached.city,
      state: cached.state,
      areas: cached.areas,
    };
  }

  const fetched = await fetchFromIndiaPost(pin);

  if (!fetched) return null;

  // Cache it. A concurrent request may have written the same row first, so
  // upsert rather than create.
  await db.pincodeArea.upsert({
    where: { pincode: pin },
    create: fetched,
    update: { city: fetched.city, state: fetched.state, areas: fetched.areas },
  });

  return fetched;
}

async function fetchFromIndiaPost(pin: string): Promise<PincodeLookup | null> {
  try {
    const response = await fetch(`${INDIA_POST}/${pin}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    });

    if (!response.ok) return null;

    const body: unknown = await response.json();
    const first = Array.isArray(body) ? (body[0] as IndiaPostReply | undefined) : null;

    if (!first || first.Status !== "Success") return null;

    const offices = first.PostOffice ?? [];
    const head = offices[0];

    if (!head) return null;

    const state = normaliseState(head.State);
    const city = (head.District ?? head.Block ?? "").trim();

    if (!city && !state) return null;

    return {
      pincode: pin,
      city,
      state,
      // De-duplicated, capped: a PIN code can have dozens of branch offices
      // and a list that long is not a useful suggestion.
      areas: [...new Set(offices.map((office) => office.Name?.trim()).filter(Boolean))]
        .slice(0, 12) as string[],
    };
  } catch {
    // Timeout, DNS failure, malformed JSON — all the same to the caller.
    return null;
  }
}
