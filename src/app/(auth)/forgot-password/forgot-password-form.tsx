"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, postJson } from "@/lib/api-client";

/**
 * Asks for the account's email and sends a reset code.
 *
 * The reply is the same whether or not an account exists, and the next screen
 * is shown either way. Saying "no account with that address" here would turn
 * the page into a way to test which of your customers' addresses are
 * registered.
 */
export function ForgotPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const email = String(new FormData(event.currentTarget).get("email") ?? "")
      .trim()
      .toLowerCase();

    if (!email) {
      setError("Enter the email address on your account.");
      return;
    }

    setIsPending(true);

    try {
      await postJson("/api/otp/send", {
        identifier: email,
        purpose: "PASSWORD_RESET",
      });

      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      // A cooldown or rate-limit message is genuinely useful, so it is shown.
      setError(
        err instanceof ApiError ? err.message : "Could not send a code right now.",
      );
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
          placeholder="you@example.com"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Sending…" : "Email me a reset code"}
      </Button>
    </form>
  );
}
