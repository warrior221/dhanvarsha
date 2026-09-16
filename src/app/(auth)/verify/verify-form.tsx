"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, postJson } from "@/lib/api-client";

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Mirrors the server's 60 second resend rule so the button reflects reality.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setIsPending(true);

    try {
      await postJson("/api/otp/verify", {
        identifier: email,
        purpose: "EMAIL_VERIFICATION",
        code,
      });
      router.push("/login?verified=1");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      );
      setIsPending(false);
    }
  }

  async function onResend() {
    setError(null);
    setNotice(null);
    setIsResending(true);

    try {
      await postJson("/api/otp/send", {
        identifier: email,
        purpose: "EMAIL_VERIFICATION",
      });
      setNotice("If that account needs verification, a new code is on its way.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not send a new code right now.",
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {notice ? (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="code">6-digit code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          required
          disabled={isPending}
          placeholder="000000"
          className="text-center text-lg tracking-[0.4em]"
        />
        <p className="text-sm text-muted-foreground">
          Sent to {email}. The code expires in 10 minutes.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Verifying…" : "Verify email"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={onResend}
        disabled={isResending || cooldown > 0}
      >
        {cooldown > 0
          ? `Resend code in ${cooldown}s`
          : isResending
            ? "Sending…"
            : "Resend code"}
      </Button>
    </form>
  );
}
