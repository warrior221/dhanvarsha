import { normaliseState } from "@/lib/pincode";

/**
 * Coordinates → an approximate Indian address, via OpenStreetMap's Nominatim.
 *
 * SERVER ONLY. Calling it from the browser would send the customer's exact
 * coordinates straight to a third party from their own IP; going through our
 * server means Nominatim sees the shop, not the shopper.
 *
 * Nominatim's usage policy requires an identifying User-Agent and no bulk
 * querying, which the route's rate limit enforces on our side.
 *
 * What comes back is a STARTING POINT. Phone GPS is regularly out by a street
 * or more, so the form fills the fields and asks the customer to check them —
 * it never submits on their behalf.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "Dhanvarsha/1.0 (saree shop checkout address lookup)";
const TIMEOUT_MS = 5_000;

export type ReverseGeocode = {
  pincode: string;
  city: string;
  state: string;
  /** Street, for the address line. */
  road: string;
  /** Locality, for the area/landmark line. */
  area: string;
};

type NominatimAddress = {
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state_district?: string;
  county?: string;
  state?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city_district?: string;
  country_code?: string;
};

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocode | null> {
  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", latitude.toString());
  url.searchParams.set("lon", longitude.toString());
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
    });

    if (!response.ok) return null;

    const body = (await response.json()) as { address?: NominatimAddress };
    const address = body.address;

    if (!address) return null;

    // The shop delivers within India only, so anything else is a wrong answer
    // rather than a partial one.
    if (address.country_code && address.country_code !== "in") return null;

    const city =
      address.city ??
      address.town ??
      address.village ??
      address.municipality ??
      address.city_district ??
      address.state_district ??
      address.county ??
      "";

    return {
      pincode: (address.postcode ?? "").replace(/\D/g, "").slice(0, 6),
      city: city.trim(),
      state: normaliseState(address.state),
      road: (address.road ?? "").trim(),
      area: (address.suburb ?? address.neighbourhood ?? "").trim(),
    };
  } catch {
    return null;
  }
}
