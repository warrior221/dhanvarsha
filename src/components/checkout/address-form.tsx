"use client";

import { Loader2, MapPin } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, getJson, requestJson } from "@/lib/api-client";
import { isCompletePincode, type PincodeLookup } from "@/lib/pincode";
import type { AddressView } from "@/lib/queries/address";
import { INDIAN_STATES, addressSchema } from "@/lib/validations/checkout";

type LocatedAddress = PincodeLookup & { road: string; area: string };

type Values = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isDefault: boolean;
};

const BLANK: Values = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  isDefault: false,
};

/** Add or edit a delivery address. Used on checkout and in the address book. */
export function AddressForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: AddressView;
  onSaved: (address: AddressView) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<Values>(
    initial
      ? {
          fullName: initial.fullName,
          line1: initial.line1,
          line2: initial.line2 ?? "",
          city: initial.city,
          state: initial.state,
          pincode: initial.pincode,
          phone: initial.phone,
          isDefault: initial.isDefault,
        }
      : BLANK,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [areas, setAreas] = useState<string[]>([]);
  const [pinStatus, setPinStatus] = useState<
    "idle" | "looking" | "filled" | "unknown"
  >("idle");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  /** The PIN code whose lookup already filled the city and state. */
  const filledFor = useRef<string>(initial?.pincode ?? "");

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  /**
   * Fills city and state from the PIN code.
   *
   * Debounced, because this fires while the customer is still typing the six
   * digits. Nothing here overwrites a field the customer has since edited for
   * the SAME PIN code — changing the PIN code is what permits a refill.
   */
  useEffect(() => {
    const pin = values.pincode;

    if (!isCompletePincode(pin)) {
      setPinStatus("idle");
      return;
    }

    if (filledFor.current === pin) return;

    let cancelled = false;
    setPinStatus("looking");

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const found = await getJson<PincodeLookup>(`/api/pincode/${pin}`);

          if (cancelled) return;

          filledFor.current = pin;
          setAreas(found.areas);
          setValues((current) =>
            // Guard against the customer having moved on to another PIN code
            // while this request was in flight.
            current.pincode === pin
              ? {
                  ...current,
                  city: found.city || current.city,
                  state: found.state || current.state,
                }
              : current,
          );
          setPinStatus(found.city || found.state ? "filled" : "unknown");
        } catch {
          if (cancelled) return;
          // A failed lookup is not an error the customer needs to act on —
          // the fields are still there to be typed into.
          filledFor.current = pin;
          setPinStatus("unknown");
          setAreas([]);
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [values.pincode]);

  /** Fills the address from the browser's location, with the customer's consent. */
  function useMyLocation() {
    setLocationError(null);

    if (!("geolocation" in navigator)) {
      setLocationError("This browser cannot share your location.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          try {
            const place = await requestJson<LocatedAddress>("/api/geocode", "POST", {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });

            filledFor.current = place.pincode;
            setAreas(place.areas ?? []);
            setValues((current) => ({
              ...current,
              pincode: place.pincode || current.pincode,
              city: place.city || current.city,
              state: place.state || current.state,
              line1: current.line1 || place.road,
              line2: current.line2 || place.area,
            }));
            setPinStatus(place.pincode ? "filled" : "idle");
          } catch (error) {
            setLocationError(
              error instanceof ApiError
                ? error.message
                : "Could not work out your address. Please type it in.",
            );
          } finally {
            setLocating(false);
          }
        })();
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was declined. Please type your address in."
            : "Could not get your location. Please type your address in.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    // Same schema the API route runs.
    const parsed = addressSchema.safeParse(values);

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".") || "_";
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }

    setSaving(true);

    try {
      const saved = initial
        ? await requestJson<AddressView>("/api/addresses", "PUT", {
            id: initial.id,
            ...parsed.data,
          })
        : await requestJson<AddressView>("/api/addresses", "POST", parsed.data);

      onSaved(saved);
      if (!initial) setValues(BLANK);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Could not save that address.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={locating}
          onClick={useMyLocation}
        >
          {locating ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Finding you…
            </>
          ) : (
            <>
              <MapPin className="size-4" aria-hidden />
              Use my current location
            </>
          )}
        </Button>

        {locationError ? (
          <p role="alert" className="text-sm text-destructive">
            {locationError}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Fills in what it can. Always check it before saving.
          </p>
        )}
      </div>

      <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
        <Input
          id="fullName"
          value={values.fullName}
          autoComplete="name"
          onChange={(event) => set("fullName", event.target.value)}
        />
      </Field>

      <Field label="Flat / house number and street" htmlFor="line1" error={errors.line1}>
        <Input
          id="line1"
          value={values.line1}
          autoComplete="address-line1"
          onChange={(event) => set("line1", event.target.value)}
        />
      </Field>

      <Field
        label="Area, landmark"
        htmlFor="line2"
        error={errors.line2}
        hint="Optional, but it helps the courier find you."
      >
        <Input
          id="line2"
          value={values.line2}
          autoComplete="address-line2"
          list={areas.length > 0 ? "pincode-areas" : undefined}
          onChange={(event) => set("line2", event.target.value)}
        />
        {/* Localities in the entered PIN code, as type-ahead suggestions. */}
        {areas.length > 0 ? (
          <datalist id="pincode-areas">
            {areas.map((area) => (
              <option key={area} value={area} />
            ))}
          </datalist>
        ) : null}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="PIN code"
          htmlFor="pincode"
          error={errors.pincode}
          hint={
            pinStatus === "looking"
              ? "Looking up your city…"
              : pinStatus === "filled"
                ? "City and state filled in — change them if they are wrong."
                : pinStatus === "unknown"
                  ? "We could not look that one up. Please fill in city and state."
                  : "We will fill in your city and state."
          }
        >
          <Input
            id="pincode"
            value={values.pincode}
            inputMode="numeric"
            maxLength={6}
            autoComplete="postal-code"
            onChange={(event) =>
              set("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </Field>

        <Field
          label="Mobile number"
          htmlFor="phone"
          error={errors.phone}
          hint="The courier will call this number."
        >
          <Input
            id="phone"
            value={values.phone}
            inputMode="tel"
            autoComplete="tel"
            placeholder="9876543210"
            onChange={(event) => set("phone", event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City / town" htmlFor="city" error={errors.city}>
          <Input
            id="city"
            value={values.city}
            autoComplete="address-level2"
            onChange={(event) => set("city", event.target.value)}
          />
        </Field>

        <Field label="State" htmlFor="state" error={errors.state}>
          <Select value={values.state} onValueChange={(value) => set("state", value)}>
            <SelectTrigger id="state">
              <SelectValue placeholder="Choose a state" />
            </SelectTrigger>
            <SelectContent>
              {INDIAN_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={values.isDefault}
          onCheckedChange={(checked) => set("isDefault", checked === true)}
        />
        Use this as my default address
      </label>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : initial ? (
            "Save changes"
          ) : (
            "Save address"
          )}
        </Button>

        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
