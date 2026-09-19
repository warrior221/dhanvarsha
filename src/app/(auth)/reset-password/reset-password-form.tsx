"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, postJson } from "@/lib/api-client";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Takes the emailed code and a new password.
 *
 * Both happen in ONE request. Verifying the code on its own first would burn
 * it, and a weak-password rejection afterwards would then leave the person
 * holding a dead code and still locked out.
 */
export function ResetPasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // Mirrors the server's 60 second resend rule.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsPending(true);

    try {
      await postJson("/api/auth/reset-password", {
        email,
        code,
        password,
        confirmPassword,
      });

      router.push("/login?reset=1");
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
      await postJson("/api/otp/send", { identifier: email, purpose: "PASSWORD_RESET" });
      setNotice("If that address has an account, a new code is on its way.");
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

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          At least 8 characters, with a letter and a number.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          disabled={isPending}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Saving…" : "Set new password"}
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
