"use client";

import { Check, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, requestJson } from "@/lib/api-client";
import {
  MFA_STEPS,
  type MfaStep,
  STEP_SHORT,
  STEP_TITLE,
  stepNumber,
} from "@/lib/mfa";
import { cn } from "@/lib/utils";

type State = {
  progress: {
    emailDone: boolean;
    whatsappDone: boolean;
    totpDone: boolean;
    skipped: MfaStep[];
  };
  next: MfaStep | null;
  complete: boolean;
  sentTo: string | null;
  whatsappSkipReason: string | null;
};

/**
 * The three-step admin sign-in ladder.
 *
 * The SERVER decides which step is current; this only draws it. Every reply
 * carries the authoritative state back, so the screen cannot get ahead of
 * what has actually been proved.
 */
export function VerifyLadder({ initial }: { initial: State }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  const step = state.next;

  async function send() {
    setBusy(true);
    setError(null);

    try {
      const next = await requestJson<State>("/api/admin/mfa/challenge", "POST", {
        action: "send",
      });
      setState(next);
      setSentTo(next.sentTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send that code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);

    try {
      const next = await requestJson<State>("/api/admin/mfa/challenge", "POST", {
        action: "verify",
        code: code.trim(),
      });

      setCode("");
      setSentTo(null);
      setState(next);

      if (next.complete) {
        // Server-rendered pages must re-read the now-verified session.
        router.replace("/admin");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function useRecovery() {
    setBusy(true);
    setError(null);

    try {
      await requestJson("/api/admin/mfa/recovery", "POST", {
        code: recoveryCode.trim(),
      });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "That recovery code did not work.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2">
        {MFA_STEPS.map((candidate) => {
          const done =
            candidate === "EMAIL"
              ? state.progress.emailDone
              : candidate === "WHATSAPP"
                ? state.progress.whatsappDone
                : state.progress.totpDone;
          const skipped = state.progress.skipped.includes(candidate);
          const current = candidate === step;

          return (
            <li
              key={candidate}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
                current && "border-foreground font-medium",
                done && "border-emerald-600/40 text-emerald-700 dark:text-emerald-500",
                skipped && !done && "text-muted-foreground line-through decoration-1",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : null}
              <span>
                {stepNumber(candidate)}. {STEP_SHORT[candidate]}
              </span>
            </li>
          );
        })}
      </ol>

      {state.whatsappSkipReason ? (
        <Alert role="status">
          <AlertDescription>{state.whatsappSkipReason}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === null ? (
        <p className="text-sm text-muted-foreground">
          All checks passed. Taking you to the dashboard…
        </p>
      ) : (
        <div className="space-y-4 rounded-lg border bg-background p-5">
          <div>
            <p className="text-sm text-muted-foreground">
              Step {stepNumber(step)} of {MFA_STEPS.length}
            </p>
            <h2 className="text-lg font-medium">{STEP_TITLE[step]}</h2>
          </div>

          {step === "TOTP" ? (
            <p className="text-sm text-muted-foreground">
              Open your authenticator app and enter the current 6-digit code.
            </p>
          ) : sentTo ? (
            <p className="text-sm text-muted-foreground">
              Sent to {sentTo}. It expires in 10 minutes.
            </p>
          ) : (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void send()}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                `Send my ${STEP_SHORT[step].toLowerCase()} code`
              )}
            </Button>
          )}

          {(step === "TOTP" || sentTo) ? (
            <div className="space-y-2">
              <Label htmlFor="mfa-code">6-digit code</Label>
              <Input
                id="mfa-code"
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

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  disabled={busy || code.length !== 6}
                  onClick={() => void verify()}
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Checking…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4" aria-hidden />
                      Continue
                    </>
                  )}
                </Button>

                {step !== "TOTP" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void send()}
                  >
                    Send another
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="rounded-lg border bg-background p-5">
        {showRecovery ? (
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-medium">Use a recovery code</h2>
              <p className="text-sm text-muted-foreground">
                One of the codes you saved when setting this up. Each works once
                and clears all three steps.
              </p>
            </div>

            <Input
              value={recoveryCode}
              placeholder="ABCDE-FGHIJ"
              className="max-w-56 font-mono"
              onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                disabled={busy || recoveryCode.trim().length < 8}
                onClick={() => void useRecovery()}
              >
                {busy ? "Checking…" : "Use this code"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setShowRecovery(false)}
              >
                Back
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => setShowRecovery(true)}
          >
            Lost your phone? Use a recovery code
          </button>
        )}
      </div>
    </div>
  );
}
