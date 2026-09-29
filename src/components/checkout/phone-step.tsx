"use client";

import { Check, Loader2, Phone } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, requestJson } from "@/lib/api-client";
import type { PhoneStatus } from "@/lib/queries/customer-phone";

/**
 * Taking a mobile number, once, before the first order.
 *
 * The courier phones ahead on the day, so an unreachable number is a failed
 * delivery and a parcel that travels twice. When a code can be sent it goes
 * over WhatsApp rather than email on purpose: a code read in an inbox proves
 * nothing about whether the handset works.
 *
 * While WhatsApp is unavailable the number is taken but not proven, and this
 * says so plainly instead of implying a check that did not happen.
 *
 * Asked once. After this the number is on the account and later orders go
 * straight through.
 */
export function PhoneStep({
  initial,
  suggested,
  onVerified,
}: {
  initial: PhoneStatus;
  /** From a saved address, so there is usually nothing to type. */
  suggested: string | null;
  onVerified: () => void;
}) {
  const [phone, setPhone] = useState(initial.phone ?? suggested ?? "");
  // Null while no code can be sent, so there is no second step to show.
  const canVerify = initial.canVerify;
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);

    try {
      const result = await requestJson<{ sentTo: string | null }>(
        "/api/account/phone",
        "POST",
        { phone: phone.trim() },
      );

      // No code to wait for: the number is saved and checkout can proceed.
      if (result.sentTo === null) {
        onVerified();
        return;
      }

      setSentTo(result.sentTo);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : canVerify
            ? "Could not send that code."
            : "Could not save that number.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);

    try {
      await requestJson<PhoneStatus>("/api/account/phone", "PUT", {
        phone: phone.trim(),
        code: code.trim(),
      });
      onVerified();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border-2 border-foreground/20 bg-background p-5">
      <div className="flex items-start gap-3">
        <Phone className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-lg font-medium">
            {canVerify ? "Confirm your mobile number" : "Your mobile number"}
          </h2>
          <p className="text-sm text-muted-foreground">
            The courier will call this number on the day. We only ask once.
          </p>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {sentTo ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="phone-code">6-digit code</Label>
            <Input
              id="phone-code"
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="max-w-40 text-center text-lg tracking-[0.4em]"
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
            <p className="text-sm text-muted-foreground">
              Sent on WhatsApp to {sentTo}. It expires in 10 minutes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || code.length !== 6}
              onClick={() => void confirm()}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Checking…
                </>
              ) : (
                <>
                  <Check className="size-4" aria-hidden />
                  Confirm number
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setSentTo(null);
                setCode("");
              }}
            >
              Use a different number
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              value={phone}
              inputMode="tel"
              autoComplete="tel"
              placeholder="9876543210"
              className="max-w-48"
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>

          <Button
            type="button"
            disabled={busy || phone.trim().length < 10}
            onClick={() => void send()}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              canVerify ? (
              "Send me a code"
            ) : (
              <>
                <Check className="size-4" aria-hidden />
                Save number
              </>
            )
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
