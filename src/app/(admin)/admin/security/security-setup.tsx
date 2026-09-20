"use client";

import { Check, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ApiError, requestJson } from "@/lib/api-client";
import type { MfaSetup } from "@/lib/queries/admin-mfa";

/**
 * Setting up the admin second factor.
 *
 * The authenticator app is the anchor and is set up first: the ladder only
 * switches on once it is confirmed, so a half-finished setup can never lock
 * the shop owner out of their own admin.
 */
export function SecuritySetup({ initial }: { initial: MfaSetup }) {
  const router = useRouter();
  const [setup, setSetup] = useState(initial);

  const [qr, setQr] = useState<{ qrDataUrl: string; manualKey: string } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const [phone, setPhone] = useState(initial.whatsappPhone ?? "");
  const [phoneSaved, setPhoneSaved] = useState(false);

  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call<T>(body: unknown): Promise<T | null> {
    setBusy(true);
    setError(null);

    try {
      return await requestJson<T>("/api/admin/mfa/enrol", "POST", body);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function begin() {
    const result = await call<{ qrDataUrl: string; manualKey: string }>({
      action: "begin",
    });
    if (result) setQr(result);
  }

  async function confirm() {
    const result = await call<{ recoveryCodes: string[] }>({
      action: "confirm",
      code: code.trim(),
    });

    if (result) {
      setRecoveryCodes(result.recoveryCodes);
      setQr(null);
      setCode("");
      setSetup((s) => ({
        ...s,
        totpConfirmed: true,
        active: true,
        // This component keeps its own copy of the setup, so the count has to
        // be updated here — router.refresh() re-renders the server page but
        // cannot reach into state already initialised from the old props.
        recoveryCodesRemaining: result.recoveryCodes.length,
      }));
      router.refresh();
    }
  }

  async function saveWhatsapp() {
    const result = await call<{ phone: string }>({ action: "whatsapp", phone });

    if (result) {
      setPhoneSaved(true);
      setSetup((s) => ({ ...s, whatsappPhone: result.phone, whatsappVerified: true }));
      setTimeout(() => setPhoneSaved(false), 2500);
    }
  }

  async function disable() {
    const result = await call<{ disabled: boolean }>({
      action: "disable",
      code: disableCode.trim(),
    });

    if (result) {
      setSetup((s) => ({ ...s, totpConfirmed: false, active: false }));
      setShowDisable(false);
      setDisableCode("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* ---------------- recovery codes, shown once ---------------- */}
      {recoveryCodes ? (
        <section className="space-y-3 rounded-lg border-2 border-amber-500/50 bg-amber-50 p-5 dark:bg-amber-950/20">
          <h2 className="text-lg font-medium">Save these recovery codes now</h2>
          <p className="text-sm">
            Each one works <strong>once</strong> and gets you past all three
            steps. This is the only time they are shown — they are stored
            scrambled, so nobody, including me, can read them back to you.
          </p>
          <p className="text-sm font-medium">
            Print them, or put them somewhere that is not your phone.
          </p>

          <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((value) => (
              <li key={value} className="rounded border bg-background px-3 py-2">
                {value}
              </li>
            ))}
          </ul>

          <Button type="button" onClick={() => setRecoveryCodes(null)}>
            I have saved them
          </Button>
        </section>
      ) : null}

      {/* ---------------- step 3: authenticator ---------------- */}
      <section className="space-y-4 rounded-lg border bg-background p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium">Authenticator app</h2>
            <p className="text-sm text-muted-foreground">
              Step 3, and the one that switches the checks on.
            </p>
          </div>

          {setup.totpConfirmed ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-500">
              <ShieldCheck className="size-4" aria-hidden />
              On
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Not set up</span>
          )}
        </div>

        {setup.totpConfirmed ? (
          <>
            <p className="text-sm text-muted-foreground">
              {setup.recoveryCodesRemaining} recovery code
              {setup.recoveryCodesRemaining === 1 ? "" : "s"} left.
            </p>

            {showDisable ? (
              <div className="space-y-3 rounded-md border p-4">
                <p className="text-sm">
                  Turning this off means your password alone opens the admin
                  area again. Enter a code from your app to confirm.
                </p>
                <Input
                  value={disableCode}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  className="max-w-40 text-center tracking-[0.3em]"
                  onChange={(event) =>
                    setDisableCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={busy || disableCode.length !== 6}
                    onClick={() => void disable()}
                  >
                    <ShieldOff className="size-4" aria-hidden />
                    Turn the checks off
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setShowDisable(false)}
                  >
                    Keep them on
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setShowDisable(true)}
              >
                Turn off / change phone
              </Button>
            )}
          </>
        ) : qr ? (
          <div className="space-y-4">
            <p className="text-sm">
              Scan this with Google Authenticator, Microsoft Authenticator,
              Authy or your password manager.
            </p>

            {/* A plain img on purpose: this is a data: URL generated on our
                own server for this one admin, so there is nothing for
                next/image to fetch, size or cache. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.qrDataUrl}
              alt="QR code for your authenticator app"
              width={200}
              height={200}
              className="rounded border bg-white p-2"
            />

            <p className="text-sm text-muted-foreground">
              Cannot scan? Type this key in instead:
              <br />
              <span className="font-mono text-foreground">{qr.manualKey}</span>
            </p>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="totp-confirm">
                Enter the 6-digit code your app now shows
              </Label>
              <Input
                id="totp-confirm"
                value={code}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                className="max-w-40 text-center text-lg tracking-[0.4em]"
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>

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
                "Confirm and get recovery codes"
              )}
            </Button>
          </div>
        ) : (
          <Button type="button" disabled={busy} onClick={() => void begin()}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Preparing…
              </>
            ) : (
              "Set up the authenticator app"
            )}
          </Button>
        )}
      </section>

      {/* ---------------- step 2: whatsapp ---------------- */}
      <section className="space-y-4 rounded-lg border bg-background p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium">WhatsApp number</h2>
            <p className="text-sm text-muted-foreground">
              Step 2 of the sign-in checks.
            </p>
          </div>

          {setup.whatsappAvailable ? null : (
            <span className="text-sm text-muted-foreground">Not connected</span>
          )}
        </div>

        {!setup.whatsappAvailable ? (
          <Alert role="status">
            <AlertDescription>
              WhatsApp needs a verified Meta Business account and a message
              template approved by Meta before it can send anything. Until that
              is done this step is <strong>skipped</strong> at sign-in, and the
              checks run with email and the authenticator app. You can still
              save the number now.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">Mobile number</Label>
            <Input
              id="whatsapp"
              value={phone}
              inputMode="tel"
              placeholder="9876543210"
              className="max-w-48"
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={busy || phone.trim().length < 10}
            onClick={() => void saveWhatsapp()}
          >
            {phoneSaved ? (
              <>
                <Check className="size-4" aria-hidden />
                Saved
              </>
            ) : (
              "Save number"
            )}
          </Button>
        </div>
      </section>

      {/* ---------------- step 1: email ---------------- */}
      <section className="rounded-lg border bg-background p-5">
        <h2 className="text-lg font-medium">Email</h2>
        <p className="text-sm text-muted-foreground">
          Step 1. Always on, sent to the address on your account — nothing to
          set up.
        </p>
      </section>
    </div>
  );
}
