import type { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, apiSuccess, handleApiError } from "@/lib/errors";
import { reverseGeocode } from "@/lib/geocode";
import { lookupPincode } from "@/lib/queries/pincode";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";

const ROUTE = "POST /api/geocode";

const bodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Turns the browser's coordinates into an address to start from.
 *
 * The coordinates are used and discarded — nothing about the customer's
 * location is stored. Only the PIN code they end up submitting is kept, as
 * part of their address.
 */
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit("geocode", clientIpFrom(request.headers));

    const body: unknown = await request.json();
    const { latitude, longitude } = bodySchema.parse(body);

    const place = await reverseGeocode(latitude, longitude);

    if (!place) {
      throw new AppError(
        "LOCATION_UNKNOWN",
        "We could not work out your address from that location. Please type it in.",
        404,
      );
    }

    // India Post is the better authority on which city and state a PIN code
    // belongs to, so prefer it when the coordinates gave us a usable one.
    if (place.pincode) {
      const byPin = await lookupPincode(place.pincode);

      if (byPin) {
        return apiSuccess({
          ...place,
          city: byPin.city || place.city,
          state: byPin.state || place.state,
          areas: byPin.areas,
        });
      }
    }

    return apiSuccess({ ...place, areas: [] });
  } catch (error) {
    return handleApiError(error, ROUTE);
  }
}
